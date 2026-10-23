const thunder = require("../providers/thunder.provider");
async function verifySlip(file) {
  return thunder.verify(file);
}
module.exports = { verifySlip };
