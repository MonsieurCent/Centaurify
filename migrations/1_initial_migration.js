const Centaurify = artifacts.require("Centaurify");

module.exports = async function (deployer) {
  await deployer.deploy(Centaurify);
};
