import ProductsPage from '../admin/ProductsPage';

// Worker A has access to products but cannot delete
export default function WorkerAProductsPage() {
  return <ProductsPage workerMode={true} />;
}
