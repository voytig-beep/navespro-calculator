import { useMemo, useState } from "react";
import { CanopyPreview3D } from "./CanopyPreview3D.jsx";
import { calculateEstimate } from "./calc.js";
import defaultPrices from "./prices.json";

const steps = ["Размеры", "Конструкция", "Материалы", "Монтаж", "Смета"];

const fmt = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
  style: "currency",
  currency: "RUB",
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || min));
const money = (value) => fmt.format(Math.round(value / 1000) * 1000);
const priceStorageKey = "canopy-prices-v1";

const initialForm = {
  length: 6,
  width: 4,
  height: 2.8,
  roofType: "single",
  covering: "cellPoly",
  frame: "standard",
  paint: "primer",
  installation: true,
  drainage: true,
  snowGuards: false,
  distance: 25,
};

const mergeItemGroup = (defaults, saved = {}) =>
  Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, { ...value, ...(saved[key] || {}) }]));

function mergePrices(defaults, saved = {}) {
  return {
    ...defaults,
    ...saved,
    base: { ...defaults.base, ...(saved.base || {}) },
    extras: { ...defaults.extras, ...(saved.extras || {}) },
    roofTypes: mergeItemGroup(defaults.roofTypes, saved.roofTypes),
    coverings: mergeItemGroup(defaults.coverings, saved.coverings),
    frames: mergeItemGroup(defaults.frames, saved.frames),
    paint: mergeItemGroup(defaults.paint, saved.paint),
  };
}

function loadPrices() {
  if (typeof window === "undefined") return defaultPrices;

  try {
    const saved = window.localStorage.getItem(priceStorageKey);
    return saved ? mergePrices(defaultPrices, JSON.parse(saved)) : defaultPrices;
  } catch {
    return defaultPrices;
  }
}

function savePrices(nextPrices) {
  try {
    window.localStorage.setItem(priceStorageKey, JSON.stringify(nextPrices));
  } catch {
    return;
  }
}

const optionEntries = (group) => Object.entries(group).map(([value, item]) => ({ value, ...item }));

function OptionGroup({ label, value, items, onChange }) {
  return (
    <section className="field">
      <p className="field-label">{label}</p>
      <div className="option-grid">
        {items.map((item) => (
          <button
            className={item.value === value ? "option active" : "option"}
            key={item.value}
            onClick={() => onChange(item.value)}
            type="button"
          >
            <strong>{item.label}</strong>
            {item.hint && <span>{item.hint}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}

function NumberField({ label, max, min, onChange, step = "0.1", suffix, value }) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <input
        aria-label={label}
        max={max}
        min={min}
        onChange={(event) => onChange(clamp(event.target.value, min, max))}
        step={step}
        type="number"
        value={value}
      />
      <b>{suffix}</b>
    </label>
  );
}

function PriceField({ label, max = 100000, min = 0, onChange, step = "1", suffix, value }) {
  return (
    <label className="price-field">
      <span>{label}</span>
      <input
        aria-label={label}
        max={max}
        min={min}
        onChange={(event) => onChange(clamp(event.target.value, min, max))}
        step={step}
        type="number"
        value={value}
      />
      <b>{suffix}</b>
    </label>
  );
}

function Toggle({ checked, label, onChange }) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
    </label>
  );
}

function PriceAdmin({ onBaseChange, onExtraChange, onItemChange, onResetPrices, prices }) {
  return (
    <section className="admin-section" id="admin">
      <div className="admin-heading">
        <p className="section-kicker">Прайс</p>
        <h2>Управление ценами</h2>
        <p>Изменения сохраняются в этом браузере и сразу влияют на расчёт.</p>
      </div>

      <div className="admin-grid">
        <article className="admin-card">
          <h3>Основные ставки</h3>
          <div className="admin-fields">
            <PriceField label="Металл" onChange={(value) => onBaseChange("steelPerM2", value)} suffix="₽/м²" value={prices.base.steelPerM2} />
            <PriceField label="Производство" onChange={(value) => onBaseChange("manufacturingPerM2", value)} suffix="₽/м²" value={prices.base.manufacturingPerM2} />
            <PriceField label="Расходные материалы" onChange={(value) => onBaseChange("consumablesPerM2", value)} suffix="₽/м²" value={prices.base.consumablesPerM2} />
            <PriceField label="Доставка" onChange={(value) => onBaseChange("delivery", value)} suffix="₽" value={prices.base.delivery} />
          </div>
        </article>

        <article className="admin-card">
          <h3>Кровля</h3>
          <div className="admin-fields">
            {Object.entries(prices.coverings).map(([key, item]) => (
              <PriceField
                key={key}
                label={item.label}
                onChange={(value) => onItemChange("coverings", key, "pricePerM2", value)}
                suffix="₽/м²"
                value={item.pricePerM2}
              />
            ))}
          </div>
        </article>

        <article className="admin-card">
          <h3>Окраска</h3>
          <div className="admin-fields">
            {Object.entries(prices.paint).map(([key, item]) => (
              <PriceField
                key={key}
                label={item.label}
                onChange={(value) => onItemChange("paint", key, "pricePerM2", value)}
                suffix="₽/м²"
                value={item.pricePerM2}
              />
            ))}
          </div>
        </article>

        <article className="admin-card">
          <h3>Коэффициенты</h3>
          <div className="admin-fields">
            {Object.entries(prices.roofTypes).map(([key, item]) => (
              <PriceField
                key={key}
                label={item.label}
                max={3}
                min={0.1}
                onChange={(value) => onItemChange("roofTypes", key, "multiplier", value, 3)}
                step="0.01"
                suffix="x"
                value={item.multiplier}
              />
            ))}
            {Object.entries(prices.frames).map(([key, item]) => (
              <PriceField
                key={key}
                label={item.label}
                max={3}
                min={0.1}
                onChange={(value) => onItemChange("frames", key, "multiplier", value, 3)}
                step="0.01"
                suffix="x"
                value={item.multiplier}
              />
            ))}
          </div>
        </article>

        <article className="admin-card">
          <h3>Дополнительно</h3>
          <div className="admin-fields">
            <PriceField label="Монтаж" onChange={(value) => onExtraChange("installationPerM2", value)} suffix="₽/м²" value={prices.extras.installationPerM2} />
            <PriceField label="Водосток" onChange={(value) => onExtraChange("drainage", value)} suffix="₽" value={prices.extras.drainage} />
            <PriceField label="Снегозадержатели" onChange={(value) => onExtraChange("snowGuards", value)} suffix="₽" value={prices.extras.snowGuards} />
          </div>
        </article>
      </div>

      <button className="secondary-action" onClick={onResetPrices} type="button">
        Сбросить прайс
      </button>
    </section>
  );
}

export function App() {
  const isAdminMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("admin") === "1";
  const [step, setStep] = useState(0);
  const [prices, setPrices] = useState(loadPrices);
  const [form, setForm] = useState(initialForm);

  const result = useMemo(() => calculateEstimate(form, prices), [form, prices]);
  const standard = result.variants[1];

  const setFormValue = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updatePrices = (updater) =>
    setPrices((current) => {
      const next = updater(current);
      savePrices(next);
      return next;
    });
  const setBasePrice = (key, value) =>
    updatePrices((current) => ({
      ...current,
      base: { ...current.base, [key]: clamp(value, 0, 100000) },
    }));
  const setExtraPrice = (key, value) =>
    updatePrices((current) => ({
      ...current,
      extras: { ...current.extras, [key]: clamp(value, 0, 100000) },
    }));
  const setItemPrice = (group, key, field, value, max = 100000) =>
    updatePrices((current) => ({
      ...current,
      [group]: {
        ...current[group],
        [key]: { ...current[group][key], [field]: clamp(value, 0, max) },
      },
    }));
  const resetCalculator = () => {
    setForm(initialForm);
    setStep(0);
  };
  const resetPrices = () => {
    try {
      window.localStorage.removeItem(priceStorageKey);
    } catch {
    }
    setPrices(defaultPrices);
  };

  const showStep = (index) => setStep(clamp(index, 0, steps.length - 1));

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top">
          НавесПро
        </a>
        <nav aria-label="Основная навигация">
          <a href={isAdminMode ? import.meta.env.BASE_URL : "#calculator"}>Калькулятор</a>
          {!isAdminMode && <a href="#estimate">Смета</a>}
          {isAdminMode && <a href="#admin">Прайс</a>}
          {!isAdminMode && <a href="#contacts">Контакты</a>}
        </nav>
      </header>

      {isAdminMode ? (
        <PriceAdmin
          onBaseChange={setBasePrice}
          onExtraChange={setExtraPrice}
          onItemChange={setItemPrice}
          onResetPrices={resetPrices}
          prices={prices}
        />
      ) : (
        <>
          <section className="hero" id="top">
            <div className="hero-copy">
              <p className="eyebrow">Москва и область · цены 2026</p>
              <h1>
                Рассчитайте стоимость <em>навеса</em> за 3 минуты
              </h1>
              <p className="lead">
                Выберите размеры, материалы и работы, чтобы получить предварительную стоимость навеса для дома или участка.
              </p>
              <div className="stats">
                <span>
                  <b>±15%</b>
                  точность черновой сметы
                </span>
                <span>
                  <b>{result.area.toFixed(1)} м²</b>
                  площадь текущего навеса
                </span>
                <span>
                  <b>{money(standard.total)}</b>
                  стандартный вариант
                </span>
              </div>
            </div>

            <aside className="hero-card" aria-label="Пример расчёта">
              <CanopyPreview3D form={form} />
              <div className="sample">
                <p>Пример: навес {form.length} x {form.width} м · стандарт</p>
                {result.rows.slice(0, 5).map(([label, value]) => (
                  <div className="sample-row" key={label}>
                    <span>{label}</span>
                    <b>{money(value)}</b>
                  </div>
                ))}
                <div className="sample-total">
                  <span>Итого</span>
                  <strong>{money(standard.total)}</strong>
                </div>
              </div>
            </aside>
          </section>

          <section className="trust">
            <p>Расчёт учитывает форму, габариты, металлокаркас, кровлю, производство, монтаж и доставку.</p>
            <div>
              <span>размеры</span>
              <span>материалы</span>
              <span>монтаж</span>
              <span>3 варианта сметы</span>
            </div>
          </section>

          <section className="calculator-section" id="calculator">
            <div className="steps" aria-label="Шаги калькулятора">
              {steps.map((item, index) => (
                <button className={step === index ? "step active" : "step"} key={item} onClick={() => showStep(index)} type="button">
                  <span>{index + 1}</span>
                  {item}
                </button>
              ))}
            </div>

            <div className="calculator-grid">
              <section className="panel">
                {step === 0 && (
                  <>
                    <p className="section-kicker">Параметры навеса</p>
                    <h2>Размеры и выезд</h2>
                    <div className="number-grid">
                      <NumberField label="Длина" max={20} min={2} onChange={(value) => setFormValue("length", value)} suffix="м" value={form.length} />
                      <NumberField label="Ширина" max={10} min={2} onChange={(value) => setFormValue("width", value)} suffix="м" value={form.width} />
                      <NumberField label="Высота столбов" max={4} min={2} onChange={(value) => setFormValue("height", value)} suffix="м" value={form.height} />
                      <NumberField label="Выезд от МКАД" max={120} min={0} onChange={(value) => setFormValue("distance", value)} suffix="км" value={form.distance} />
                    </div>
                  </>
                )}

                {step === 1 && (
                  <>
                    <p className="section-kicker">Каркас</p>
                    <h2>Форма и запас прочности</h2>
                    <OptionGroup
                      label="Форма навеса"
                      items={optionEntries(prices.roofTypes)}
                      onChange={(value) => setFormValue("roofType", value)}
                      value={form.roofType}
                    />
                    <OptionGroup
                      label="Металлокаркас"
                      items={optionEntries(prices.frames)}
                      onChange={(value) => setFormValue("frame", value)}
                      value={form.frame}
                    />
                  </>
                )}

                {step === 2 && (
                  <>
                    <p className="section-kicker">Материалы</p>
                    <h2>Кровля и окраска</h2>
                    <OptionGroup
                      label="Покрытие кровли"
                      items={optionEntries(prices.coverings)}
                      onChange={(value) => setFormValue("covering", value)}
                      value={form.covering}
                    />
                    <OptionGroup
                      label="Окраска металла"
                      items={optionEntries(prices.paint)}
                      onChange={(value) => setFormValue("paint", value)}
                      value={form.paint}
                    />
                  </>
                )}

                {step === 3 && (
                  <>
                    <p className="section-kicker">Работы</p>
                    <h2>Монтаж и комплектация</h2>
                    <div className="toggle-list">
                      <Toggle checked={form.installation} label="Монтаж на участке" onChange={(value) => setFormValue("installation", value)} />
                      <Toggle checked={form.drainage} label="Водосточная система" onChange={(value) => setFormValue("drainage", value)} />
                      <Toggle checked={form.snowGuards} label="Снегозадержатели" onChange={(value) => setFormValue("snowGuards", value)} />
                    </div>
                  </>
                )}

                {step === 4 && (
                  <>
                    <p className="section-kicker">Итог</p>
                    <h2>Три варианта сметы</h2>
                    <div className="variants" id="estimate">
                      {result.variants.map((variant) => (
                        <article className={variant.name === "Стандарт" ? "variant featured" : "variant"} key={variant.name}>
                          <span>{variant.name}</span>
                          <strong>{money(variant.total)}</strong>
                          <p>{variant.note}</p>
                        </article>
                      ))}
                    </div>
                    <div className="estimate-table">
                      {result.rows.map(([label, value]) => (
                        <div key={label}>
                          <span>{label}</span>
                          <b>{money(value)}</b>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="controls">
                  <button disabled={step === 0} onClick={() => showStep(step - 1)} type="button">
                    Назад
                  </button>
                  <button onClick={resetCalculator} type="button">
                    Сбросить
                  </button>
                  <button className="primary" onClick={() => showStep(step + 1)} type="button">
                    {step === steps.length - 1 ? "Пересчитать" : "Далее"}
                  </button>
                </div>
              </section>

              <aside className="summary-card">
                <p>Текущий расчёт</p>
                <h3>{form.length} x {form.width} м</h3>
                <div className="summary-line">
                  <span>Площадь</span>
                  <b>{result.area.toFixed(1)} м²</b>
                </div>
                <div className="summary-line">
                  <span>Форма</span>
                  <b>{prices.roofTypes[form.roofType].label}</b>
                </div>
                <div className="summary-line">
                  <span>Кровля</span>
                  <b>{prices.coverings[form.covering].label}</b>
                </div>
                <div className="summary-price">
                  <span>Стандарт</span>
                  <strong>{money(standard.total)}</strong>
                </div>
              </aside>
            </div>
          </section>

          <section className="content-band">
            <article>
              <p className="section-kicker">Преимущества</p>
              <h2>Смета до заявки</h2>
              <p>Расчёт сразу показывает ориентир по бюджету и фиксирует выбранные размеры, материалы, монтаж и опции.</p>
            </article>
            <article>
              <p className="section-kicker">Цены</p>
              <h2>Прайс можно обновлять</h2>
              <p>Стоимость материалов, работ и коэффициенты меняются в разделе управления прайсом.</p>
            </article>
            <article>
              <p className="section-kicker">Заявка</p>
              <h2>Уточнение сметы</h2>
              <p id="contacts">После расчёта можно отправить параметры навеса и согласовать сроки работ.</p>
            </article>
          </section>
        </>
      )}
    </main>
  );
}

export { calculateEstimate };
