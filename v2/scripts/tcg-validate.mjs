#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { validateCatalog } from '../src/tcg-catalog.js';
const path = process.argv[2] || new URL('../data/tcg-catalog-snapshot.json', import.meta.url);
const raw = JSON.parse(readFileSync(path,'utf8'));
const report = validateCatalog(Array.isArray(raw) ? raw : raw.cards);
console.log(JSON.stringify(report,null,2));
if (report.blocking || report.overpowered) process.exitCode = 1;
