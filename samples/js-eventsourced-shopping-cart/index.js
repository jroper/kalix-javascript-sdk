/*
 * Copyright 2019 Lightbend Inc.
 */

const AkkaServerless = require("@lightbend/akkaserverless-javascript-sdk").AkkaServerless;

const server = new AkkaServerless();
server.addComponent(require("./shoppingcart"));

server.start();
