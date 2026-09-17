export async function chooseExportOption(page, label, option) {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.getByRole('menuitemradio', { name: option, exact: true }).click();
  await page.getByRole('menuitemradio', { name: option, exact: true }).waitFor({ state: 'detached' });
}
