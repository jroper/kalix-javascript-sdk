/*
 * Copyright 2021 Lightbend Inc.
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

const akkaserverless = require("@lightbend/akkaserverless-javascript-sdk");
const should = require("chai").should();

const testkit = new akkaserverless.IntegrationTestkit();
testkit.addComponent(require("../shoppingcart"));

function client() {
  return testkit.clients.ShoppingCartService;
}

describe("Shopping cart service", function() {

  this.timeout(60000);

  before(done => testkit.start(done));
  after(done => testkit.shutdown(done));

  it("should default to an empty cart", async () => {
    (await client().getCartAsync({cartId: "cart1"})).should.be.empty;
  });

  it("should add items to a cart", async () => {
    await client().addItemAsync({cartId: "cart2", productId: "a", name: "Apple", quantity: 1});
    await client().addItemAsync({cartId: "cart2", productId: "b", name: "Banana", quantity: 2});
    await client().addItemAsync({cartId: "cart2", productId: "c", name: "Cantaloupe", quantity: 3});
    (await client().getCartAsync({cartId: "cart2"})).items.should.have.deep.members([
      { productId: 'a', name: 'Apple', quantity: 1 },
      { productId: 'b', name: 'Banana', quantity: 2 },
      { productId: 'c', name: 'Cantaloupe', quantity: 3 }
    ]);
  });

  it("should remove items from a cart", async () => {
    await client().addItemAsync({cartId: "cart3", productId: "a", name: "Apple", quantity: 1});
    await client().addItemAsync({cartId: "cart3", productId: "b", name: "Banana", quantity: 2});
    (await client().getCartAsync({cartId: "cart3"})).items.should.have.deep.members([
      { productId: 'a', name: 'Apple', quantity: 1 },
      { productId: 'b', name: 'Banana', quantity: 2 }
    ]);
    await client().removeItemAsync({cartId: "cart3", productId: "a"});
    (await client().getCartAsync({cartId: "cart3"})).items.should.have.deep.members([
      { productId: 'b', name: 'Banana', quantity: 2 }
    ]);
  });

  it("should remove a cart", async () => {
    await client().addItemAsync({cartId: "cart4", productId: "a", name: "Apple", quantity: 42});
    (await client().getCartAsync({cartId: "cart4"})).items.should.have.deep.members([
      { productId: 'a', name: 'Apple', quantity: 42 }
    ]);
    await client().removeCartAsync({cartId: "cart4"});
    (await client().getCartAsync({cartId: "cart4"})).should.be.empty;
  });

});
