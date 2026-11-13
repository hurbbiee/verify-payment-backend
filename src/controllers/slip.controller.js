const service = require('../services/slip.service');
async function verifySlip(req, res, next) {
  try {
    const { keyLabel, ...result } = await service.verifySlip(req.file, req.body?.provider);
    res.json(result);
  }
  catch (error) { next(error); }
}
module.exports = { verifySlip };
