import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { calculateEstimate } from "./calc.js";

const prices = JSON.parse(await readFile(new URL("./prices.json", import.meta.url), "utf8"));
const baseForm = {
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

const result = calculateEstimate(baseForm, prices);

assert.equal(result.area, 24);
assert.equal(Math.round(result.variants[1].total), 340800);
assert.equal(result.rows.length, 8);

console.log("calc self-check passed");
