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
    { productId: 3, quantity: 2, unitPrice: 10, size: 'M', colour: 'Blue' },
    { productId: 3, quantity: 1, unitPrice: 10, size: 'L', colour: 'Black' },
  ],
};

test('matching ignores payment and unit price but requires item details and issue type', () => {
  const dispatchEntry = {
    ...sale,
    paymentMode: undefined,
    items: [...sale.items].reverse().map(({ unitPrice, ...item }) => item),
  };

  assert.equal(saleMatchesHelper(sale, dispatchEntry), true);
  assert.equal(saleMatchesHelper(sale, { ...dispatchEntry, saleType: 'RETAIL' }), false);
});

test('matching rejects a different product variant or quantity', () => {
  const wrongColour = {
    ...sale,
    items: sale.items.map((item, index) =>
      index === 0 ? { ...item, colour: 'Red' } : item
    ),
  };
  const wrongQuantity = {
    ...sale,
    items: sale.items.map((item, index) =>
      index === 0 ? { ...item, quantity: 3 } : item
    ),
  };

  assert.equal(saleMatchesHelper(sale, wrongColour), false);
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

test('dispatch request contains no payment or pricing fields', () => {
  const result = workerBSaleSchema.safeParse({
    customerId: 21,
    saleType: 'WHOLESALE',
    items: [{ productId: 3, quantity: 2, size: 'M', colour: 'Blue' }],
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.data.items[0], {
    productId: 3,
    quantity: 2,
    size: 'M',
    colour: 'Blue',
  });
});
