import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const hashedAdmin = await bcrypt.hash('admin123', 10);
  const hashedWorker = await bcrypt.hash('worker123', 10);

  // Admin
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      name: 'Administrator',
      username: 'admin',
      passwordHash: hashedAdmin,
      role: 'ADMIN',
    },
  });

  // Worker A
  const workerA = await prisma.user.upsert({
    where: { username: 'worker_a' },
    update: {},
    create: {
      name: 'Worker A (Sales)',
      username: 'worker_a',
      passwordHash: hashedWorker,
      role: 'WORKER_A',
    },
  });

  // Worker B
  const workerB = await prisma.user.upsert({
    where: { username: 'worker_b' },
    update: {},
    create: {
      name: 'Worker B (Confirmer)',
      username: 'worker_b',
      passwordHash: hashedWorker,
      role: 'WORKER_B',
    },
  });

  // Sample products
  const products = [
    { name: 'Classic Singlet', brand: 'ProWear', category: 'Singlets', colours: ['White', 'Black', 'Navy'], sizes: ['S', 'M', 'L', 'XL', 'XXL'], quantity: 150, price: 25.00 },
    { name: 'Boxer Shorts', brand: 'ComfortFit', category: 'Underwear', colours: ['White', 'Grey', 'Blue'], sizes: ['S', 'M', 'L', 'XL'], quantity: 200, price: 35.00 },
    { name: 'Sports Bra', brand: 'ActiveWear', category: 'Bras', colours: ['Black', 'White', 'Red', 'Pink'], sizes: ['32B', '34B', '36C', '38C'], quantity: 80, price: 45.00 },
    { name: 'Cotton Underwear (Pack)', brand: 'ProWear', category: 'Underwear', colours: ['Assorted'], sizes: ['S', 'M', 'L', 'XL'], quantity: 120, price: 55.00 },
    { name: 'Polo T-Shirt', brand: 'StylePlus', category: 'T-Shirts', colours: ['White', 'Navy', 'Red', 'Green'], sizes: ['S', 'M', 'L', 'XL', 'XXL'], quantity: 95, price: 65.00 },
    { name: 'Thermal Vest', brand: 'WarmWear', category: 'Singlets', colours: ['White', 'Black'], sizes: ['M', 'L', 'XL'], quantity: 8, price: 40.00 },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { id: (await prisma.product.findFirst({ where: { name: p.name } }))?.id || 0 },
      update: {},
      create: { ...p, colours: p.colours, sizes: p.sizes },
    });
  }

  // Sample customers
  const customers = [
    { name: 'Kwame Mensah', phone: '0244123456', email: 'kwame@example.com', customerType: 'REGISTERED' as const },
    { name: 'Akosua Boateng', phone: '0554987654', email: 'akosua@example.com', customerType: 'REGISTERED' as const },
    { name: 'Yaw Darko', phone: '0271345678', customerType: 'WALK_IN' as const },
  ];

  for (const c of customers) {
    const existing = await prisma.customer.findFirst({ where: { phone: c.phone } });
    if (!existing) {
      await prisma.customer.create({ data: c });
    }
  }

  console.log('✅ Seeded successfully!');
  console.log(`
📋 Default Credentials:
  Admin:    admin / admin123
  Worker A: worker_a / worker123
  Worker B: worker_b / worker123

⚠️  Change passwords after first login!
  `);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
