/*
 * Copyright 2019 Lightbend Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * The CloudState namespace.
 *
 * @namespace cloudstate
 */

/**
 * A CloudState entity.
 *
 * @interface cloudstate.Entity
 */

/**
 * Start a user function server with just this entity.
 *
 * @function cloudstate.Entity#start
 * @param {cloudstate.CloudState~startOptions=} options The options for starting the server.
 * @returns {number} The port number that the server bound to.
 */

const path = require("path");
const grpc = require("grpc");
const protoLoader = require("@grpc/proto-loader");
const fs = require("fs");

const debug = require("debug")("cloudstate");
// Bind to stdout
debug.log = console.log.bind(console);

const packageInfo = require(path.join(__dirname, "..", "package.json"));
const serviceInfo = {
  serviceName: "",
  serviceVersion: ""
};
try {
  const thisPackageInfo = require(path.join(process.cwd(), "package.json"));
  if (thisPackageInfo.name) {
    serviceInfo.serviceName = thisPackageInfo.name;
  }
  if (thisPackageInfo.version) {
    serviceInfo.serviceVersion = thisPackageInfo.version;
  }
} catch (e) {
  // ignore, if we can't find it, no big deal
}

/**
 * A CloudState server.
 *
 * @memberOf cloudstate
 */
class CloudState {

  /**
   * @typedef cloudstate.CloudState~options
   * @property {string} [serviceName=<name from package.json>] The name of this service.
   * @property {string} [serviceVersion=<version from package.json>] The version of this service.
   */

  /**
   * Create a new cloudstate server.
   *
   * @param {cloudstate.CloudState~options=} options The options for this server.
   */
  constructor(options) {
    try {
      this.proto = fs.readFileSync("user-function.desc");
    } catch (e) {
      console.error("Unable to load user-function.desc protobuf descriptor!");
      throw e;
    }

    this.options = {
      ...serviceInfo,
      ...options
    };

    this.entities = [];
  }

  /**
   * Add an entity to this server.
   *
   * @param {cloudstate.Entity} entities The entities to add.
   * @returns {cloudstate.CloudState} This server.
   */
  addEntity(...entities) {
    this.entities = this.entities.concat(entities);
    return this;
  }

  /**
   * Options for starting a server.
   *
   * @typedef cloudstate.CloudState~startOptions
   * @property {string} [bindAddress="0.0.0.0"] The address to bind to.
   * @property {number} [bindPort=8080] The port to bind to, specify zero for a random ephemeral port.
   */

  /**
   * Start this server.
   *
   * @param {cloudstate.CloudState~startOptions=} options The options for starting.
   * @returns {number} The port that was bound to, useful for when a random ephemeral port was requested.
   */
  start(options) {
    const opts = {
      ...{
        bindAddress: "0.0.0.0",
        bindPort: 8080
      },
      ...options
    };

    const allEntitiesMap = {};
    this.entities.forEach(entity => {
      allEntitiesMap[entity.serviceName] = entity.service;
    });

    const entityTypes = {};
    this.entities.forEach(entity => {
      const entityServices = entity.register(allEntitiesMap);
      entityTypes[entityServices.entityType()] = entityServices;
    });

    this.server = new grpc.Server();

    Object.values(entityTypes).forEach(services => {
      services.register(this.server);
    });

    const includeDirs = [
      path.join(__dirname, "..", "proto"),
      path.join(__dirname, "..", "protoc", "include")
    ];
    const packageDefinition = protoLoader.loadSync(path.join("cloudstate", "entity.proto"), {
      includeDirs: includeDirs
    });
    const grpcDescriptor = grpc.loadPackageDefinition(packageDefinition);

    const entityDiscovery = grpcDescriptor.cloudstate.EntityDiscovery.service;

    this.server.addService(entityDiscovery, {
      discover: this.discover.bind(this),
      reportError: this.reportError.bind(this)
    });

    const boundPort = this.server.bind(opts.bindAddress + ":" + opts.bindPort, grpc.ServerCredentials.createInsecure());
    this.server.start();
    console.log("gRPC server started on " + opts.bindAddress + ":" + boundPort);

    return boundPort;
  }

  discover(call, callback) {
    const protoInfo = call.request;
    debug("Discover call with info %o, sending %s entities", protoInfo, this.entities.length);
    const entities = this.entities.map(entity => {
      return {
        entityType: entity.entityType(),
        serviceName: entity.serviceName,
        persistenceId: entity.options.persistenceId
      };
    });
    callback(null, {
      proto: fs.readFileSync("user-function.desc"), // Why not serve "this.proto"? We already load it in the constructor…
      entities: entities,
      serviceInfo: {
        serviceName: this.options.serviceName,
        serviceVersion: this.options.serviceVersion,
        serviceRuntime: process.title + " " + process.version,
        supportLibraryName: packageInfo.name,
        supportLibraryVersion: packageInfo.version
      }
    });
  }

  reportError(call, callback) {
    const msg = call.request.message;
    console.error("Error reported from sidecar: " + msg);
    callback(null, {});
  }

  /**
   * Shutdown this server.
   */
  shutdown() {
    this.server.tryShutdown(() => {
      console.log("gRPC server has shutdown.");
    });
  }
}

module.exports = CloudState;
