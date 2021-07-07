const Centaurify = artifacts.require("Centaurify");
const TokenSale = artifacts.require("TokenSale");
const VestingVault = artifacts.require("VestingVault");

module.exports = async function (deployer) {
  await deployer.deploy(Centaurify);
  const token = await Centaurify.deployed();

  await deployer.deploy(VestingVault, token.address);
  const vesting = await VestingVault.deployed();
  
  const duration = {
    seconds: function (val) { return val; },
    minutes: function (val) { return val * this.seconds(60); },
    hours: function (val) { return val * this.minutes(60); },
    days: function (val) { return val * this.hours(24); },
    weeks: function (val) { return val * this.days(7); },
    years: function (val) { return val * this.days(365); },
  };

  // Dev comments - For development closing time is set to 30 days
  const latestTime = (new Date).getTime();
  const _openingTime = latestTime + duration.minutes(1);
  const _closingTime = _openingTime + duration.days(30);

  // Dev comments - change 0x0000000000000000000000000000000000000000 to the owner address
  await deployer.deploy(TokenSale, 1, "0x0000000000000000000000000000000000000000", token.address, vesting.address, _openingTime, _closingTime);
  const crowdsale = await TokenSale.deployed();

  await token.transfer(crowdsale.address, await token.totalSupply())
};
