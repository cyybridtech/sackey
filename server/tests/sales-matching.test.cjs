const assert = require('node:assert/strict');
const test = require('node:test');
const {
  saleMatchesHelper,
  choosePendingSaleHelper,
  initialSaleStatusHelper,
} = require('../src/controllers/sales.controller');
const { workerBSaleSchema } = require('../src/schemas/sales.schema');

const sale = {
  customerId: 21,
  paymentMode: 'CC',
  saleType: 'WHOLESALE',
  discountAmount: 5,
  items: [
    { productId: 3, quantity: 2, unitPrice: 10 },
    { productId: 4, quantity: 1, unitPrice: 10 },
  ],
};

test('matching verifies customer, paymentMode, saleType, and item quantities while ignoring unit prices', () => {
  const dispatchEntry = {
    customerId: 21,
    paymentMode: 'CC',
    saleType: 'WHOLESALE',
    items: [
      { productId: 4, quantity: 1 },
      { productId: 3, quantity: 2 },
    ],
  };

  assert.equal(saleMatchesHelper(sale, dispatchEntry), true);
  assert.equal(saleMatchesHelper(sale, { ...dispatchEntry, saleType: 'RETAIL' }), false);
  assert.equal(saleMatchesHelper(sale, { ...dispatchEntry, paymentMode: 'CREDIT' }), false);
});

test('matching rejects a different product or quantity', () => {
  const wrongProduct = {
    customerId: 21,
    paymentMode: 'CC',
    saleType: 'WHOLESALE',
    items: [
      { productId: 99, quantity: 2 },
      { productId: 4, quantity: 1 },
    ],
  };
  const wrongQuantity = {
    customerId: 21,
    paymentMode: 'CC',
    saleType: 'WHOLESALE',
    items: [
      { productId: 3, quantity: 5 },
      { productId: 4, quantity: 1 },
    ],
  };

  assert.equal(saleMatchesHelper(sale, wrongProduct), false);
  assert.equal(saleMatchesHelper(sale, wrongQuantity), false);
});

test('matching rejects a different customer or sale type', () => {
  assert.equal(saleMatchesHelper(sale, { ...sale, customerId: 22 }), false);
  assert.equal(saleMatchesHelper(sale, { ...sale, saleType: 'RETAIL' }), false);
});

test('pending selection never pairs an unmatched entry with an arbitrary sale', () => {
  const candidates = [
    { id: 1, entry: { ...sale, saleType: 'RETAIL' } },
    { id: 2, entry: sale },
  ];

  const matchesSale = (candidate) => saleMatchesHelper(sale, candidate.entry);
  assert.equal(choosePendingSaleHelper(candidates, matchesSale), candidates[1]);
  assert.equal(choosePendingSaleHelper([candidates[0]], matchesSale), undefined);
  assert.equal(choosePendingSaleHelper([candidates[1], { id: 3, entry: sale }], matchesSale), undefined);
});

test('sale entries await Dispatch and dispatch entries await Sales', () => {
  assert.equal(initialSaleStatusHelper(true), 'BLUE');
  assert.equal(initialSaleStatusHelper(false), 'RED');
});

test('dispatch request validates paymentMode, customerId, saleType, and items without size/colour', () => {
  const result = workerBSaleSchema.safeParse({
    customerId: 21,
    paymentMode: 'CC',
    saleType: 'WHOLESALE',
    items: [{ productId: 3, quantity: 2 }],
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.data.items[0], {
    productId: 3,
    quantity: 2,
  });
  assert.equal(result.data.paymentMode, 'CC');
});
