const service = require('../services/slip.service');
async function verifySlip(req, res, next) {
  try { res.json(await service.verifySlip(req.file)); }
  catch (error) { next(error); }
}
module.exports = { verifySlip };