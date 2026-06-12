function defaultExpiryIso() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
}

module.exports = { defaultExpiryIso };
