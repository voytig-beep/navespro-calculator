export function calculateEstimate(form, prices) {
  const area = form.length * form.width;
  const roof = prices.roofTypes[form.roofType];
  const covering = prices.coverings[form.covering];
  const frame = prices.frames[form.frame];
  const paint = prices.paint[form.paint];
  const heightFactor = form.height > 3 ? 1.08 : 1;
  const cityFactor = form.distance > 40 ? 1.05 : 1;

  const steel = area * prices.base.steelPerM2 * roof.multiplier * frame.multiplier * heightFactor;
  const roofCovering = area * covering.pricePerM2 * roof.multiplier;
  const painting = area * paint.pricePerM2 * frame.multiplier;
  const manufacturing = area * prices.base.manufacturingPerM2 * frame.multiplier;
  const consumables = area * prices.base.consumablesPerM2;
  const installation = form.installation ? area * prices.extras.installationPerM2 * cityFactor : 0;
  const drainage = form.drainage ? prices.extras.drainage : 0;
  const snowGuards = form.snowGuards ? prices.extras.snowGuards : 0;
  const delivery = prices.base.delivery * cityFactor;

  const subtotal =
    steel + roofCovering + painting + manufacturing + consumables + installation + drainage + snowGuards + delivery;

  return {
    area,
    rows: [
      ["Металлокаркас", steel],
      ["Кровля", roofCovering],
      ["Окраска", painting],
      ["Производство", manufacturing],
      ["Расходные материалы", consumables],
      ["Монтаж", installation],
      ["Водосток и снегозадержатели", drainage + snowGuards],
      ["Доставка", delivery],
    ].filter(([, value]) => value > 0),
    variants: [
      { name: "Эконом", note: "Базовая комплектация", total: subtotal * 0.9 },
      { name: "Стандарт", note: "Оптимальная смета", total: subtotal },
      { name: "Усиленный", note: "Запас прочности", total: subtotal * 1.18 },
    ],
  };
}
