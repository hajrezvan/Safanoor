// 🧪 Load pg-boss ESM through Node 24; Jest 29's VM cannot require ESM dependencies.
const { createRequire } = process.getBuiltinModule('module');
module.exports = createRequire(__filename)('pg-boss');
