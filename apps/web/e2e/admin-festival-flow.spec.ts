import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@fenac.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

test('organizer logs in, creates a festival, and publishes it', async ({ page }) => {
  test.skip(!ADMIN_PASSWORD, 'SEED_ADMIN_PASSWORD must be set to the seeded admin password to run this test');

  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Senha').fill(ADMIN_PASSWORD as string);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL('/festivals');

  await page.getByRole('link', { name: 'Novo Festival' }).click();
  await expect(page).toHaveURL('/festivals/new');

  const uniqueNumber = Math.floor(Math.random() * 1000) + 100;
  await page.getByLabel('Número').fill(String(uniqueNumber));
  await page.getByLabel('Ano').fill('2099');
  await page.getByLabel('Nome').fill('Festival de Teste E2E');
  await page.getByLabel('Início das inscrições').fill('2099-01-01T08:00');
  await page.getByLabel('Fim das inscrições').fill('2099-03-01T18:00');
  await page.getByLabel('Valor da inscrição').fill('10');
  await page.getByRole('button', { name: 'Criar Festival' }).click();

  await expect(page.getByText('Festival de Teste E2E')).toBeVisible();
  await expect(page.getByText('DRAFT')).toBeVisible();

  await page.getByRole('button', { name: 'Publicar' }).click();

  await expect(page.getByText('OPEN')).toBeVisible();
});
