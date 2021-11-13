const { expect } = require('chai');
const { now, mine, setTime, setTimeAndMine, Ganache,
  impersonate, skipBlocks, stopMining, startMining, addToBlock } = require('./helpers');
const LPS = require('./LiquidityProtectionService.json');
const PLPS = require('./PLPS.json');

const expectArray = (actual, expected) => {
  for (let i = 0; i < actual.length; i++) {
    expect(actual[i].toString()).to.equal(expected[i].toString());
  }
};

function tokens(n) {
  return ethers.utils.parseEther(n);
}

const AddressZero = ethers.constants.AddressZero;
const ZeroAddress = impersonate(AddressZero);

describe('Centaurify Token With Protection', function() {
  let owner, user1, user2, user3, revoker;
  let ownerSigner, user1Signer, user2Signer, user3Signer, revokerSigner, ImpersonateMinterSigner;
  let lps, lp, lpSigner, plps;

  const EXT = 10n ** 18n;
  const HUNDRED_PERCENT = 10n ** 18n;
  const TOTAL_SUPPLY = 1000000000n * EXT;
  const PROTECTION_FEE = 1856000n * EXT;
  const ganache = new Ganache();
  const SOME_ADDRESS = '0x1000000000000000000000000000000000000000';
  const FREEZE = 15;
  const GAS_LIMIT = { gasLimit: 200000 };

  const Token = {
    Name: 'Centaurify',
    Symbol: 'CENT',
    Decimals: 18,
    TotalSupply: TOTAL_SUPPLY
  }

  const ProtectionConfig = {
    FirstBlockTrap_skip: false,

    LiquidityAmountTrap_skip: false,
    LiquidityAmountTrap_blocks: 5,
    LiquidityAmountTrap_amount: 296000n * EXT,

    LiquidityPercentTrap_skip: false,
    LiquidityPercentTrap_blocks: 6,
    LiquidityPercentTrap_percent: HUNDRED_PERCENT / 25n,

    LiquidityActivityTrap_skip: false,
    LiquidityActivityTrap_blocks: 3,
    LiquidityActivityTrap_count: 8,

    TokensToPutIntoLiquidityPool: 8000000n * EXT,


    PredeployedLPS: '0x8BC02aaC27aE0E5d33bB362673f41aFfB9CF735b',
    PredeployedLPSCore: '0x9cAAEe8e88861a2EED43701e0B310948179DD162',

  }

  const TRAP = ProtectionConfig.LiquidityAmountTrap_amount;
  const PERCENT_TRAP = ProtectionConfig.LiquidityPercentTrap_percent;

  before('snapshot', async function() {
    await skipBlocks(FREEZE);
    [ownerSigner, user1Signer, user2Signer, user3Signer, revokerSigner] = await ethers.getSigners();
    ImpersonateMinterSigner = await impersonate('0x2Ac123Fcd4afd896A21e953fb9990bf73752CBd6');
    owner = ownerSigner.address;
    user1 = user1Signer.address;
    user2 = user2Signer.address;
    user3 = user3Signer.address;
    revoker = revokerSigner.address;
    if (ethers.utils.isAddress(ProtectionConfig.PredeployedLPSCore)) {
      lps = await ethers.getContractAt(LPS.abi, ProtectionConfig.PredeployedLPSCore);
    } else {
      const LiquidityProtectionService = new ethers.ContractFactory(LPS.abi, LPS.bytecode, ownerSigner);
      lps = await LiquidityProtectionService.deploy();
      await lps.deployed();
    }
    if (ethers.utils.isAddress(ProtectionConfig.PredeployedLPS)) {
      plps = await ethers.getContractAt(PLPS.abi, ProtectionConfig.PredeployedLPS);
    } else {
      const PLPSFactory = new ethers.ContractFactory(PLPS.abi, PLPS.bytecode, ownerSigner);
      plps = await PLPSFactory.deploy();
      await plps.deployed();
    }
    console.log('PLPS: ', plps.address)

    const POGCoin = await ethers.getContractFactory('CentaurifyToken');
    ext = await POGCoin.deploy();
    await ext.deployed();
    lp = await ext.getLiquidityPool();
    lpSigner = await impersonate(lp);
    ext.transfer(plps.address, PROTECTION_FEE, GAS_LIMIT);
    await user3Signer.sendTransaction({to: lp, value: ethers.utils.parseEther("10.0")});
    await (await ownerSigner.sendTransaction({to: lp, value: ethers.utils.parseEther('1')})).wait();
    await ganache.snapshot();
  });
  afterEach('revert', function() { return ganache.revert(); });

  beforeEach('setup', async function() {
    await startMining();
  });

  describe("Deployment", () => {

    it("name should be " + Token.Name, async () => {
      expect(await ext.connect(ownerSigner).name()).to.be.equal(Token.Name);
    });

    it("symbol should be " + Token.Symbol, async () => {
      expect(await ext.connect(ownerSigner).symbol()).to.be.equal(Token.Symbol);
    });

    it("should have " + Token.Decimals + " decimals", async () => {
      expect(await ext.connect(ownerSigner).decimals()).to.be.equal(Token.Decimals);
    });

    it("total supply should be " + Token.TotalSupply + " tokens", async () => {
      expect(await ext.connect(ownerSigner).totalSupply()).to.be.equal(Token.TotalSupply);
    });

  });


  describe("allowance", () => {

    it("allowance works as expected", async () => {
      await ext.connect(ownerSigner).transfer(user1, tokens("5"));
      expect(await ext.connect(ownerSigner).allowance(owner, user1)).to.equal(tokens("0"));
      await ext.connect(ownerSigner).approve(user1, tokens("5"));
      expect(await ext.connect(ownerSigner).allowance(owner, user1)).to.equal(tokens("5"));
      await ext.connect(ownerSigner).increaseAllowance(user1, tokens("3"));
      expect(await ext.connect(ownerSigner).allowance(owner, user1)).to.equal(tokens("8"));
      await ext.connect(ownerSigner).decreaseAllowance(user1, tokens("4"));
      expect(await ext.connect(ownerSigner).allowance(owner, user1)).to.equal(tokens("4"));
      await expect(ext.connect(ownerSigner).decreaseAllowance(user1, tokens("5"))).to.be.revertedWith("ERC20: decreased allowance below zero");
      expect(await ext.connect(ownerSigner).allowance(owner, user1)).to.equal(tokens("4"));
    });

  });

  describe("approve", () => {

    it("cannot approve the zero address to move your tokens", async () => {
      await ext.connect(ownerSigner).transfer(user1, tokens("5"));
      await expect(ext.connect(user1).approve(AddressZero, tokens("5"))).to.be.reverted;
    });

    // it("zero address cannot approve burned tokens to be moved", async () => {
    //   const { pad, user1, ZeroAddress} = await deployWithTokenHolders();
    //   // Open github issue here
    //   await expect(pad.connect(ZeroAddress).approve(user1.address, tokens("5"))).to.be.reverted;
    // });

  });

  describe("transferFrom", () => {

    it("allows you transfer an address' tokens to another address", async () => {
      await ext.connect(ownerSigner).transfer(user1, tokens("5"));
      await ext.connect(ownerSigner).transfer(user2, tokens("10"));
      await ext.connect(ownerSigner).transfer(user3, tokens("20"));
      await ext.connect(user1Signer).approve(user2, tokens("5"));
      await ext.connect(user2Signer).transferFrom(user1, user3, tokens("5"));
    });

  });

  describe("Liquidity Protection Service", () => {
    it('Should have valid initial distribution', async function() {
      await (await ext.transfer(lp, ProtectionConfig.TokensToPutIntoLiquidityPool, GAS_LIMIT)).wait();
      expect(await ext.isProtected()).to.be.true;
      expect(await ext.balanceOf(owner)).to.equal(TOTAL_SUPPLY-PROTECTION_FEE-ProtectionConfig.TokensToPutIntoLiquidityPool);
      await ext.transfer(user1, 10);
      expect(await ext.balanceOf(user1)).to.equal(10);
      await ext.connect(user1Signer).transfer(user2, 10);
      expect(await ext.balanceOf(user2)).to.equal(10);
      await ext.transfer(user1, TRAP);
      expect(await ext.balanceOf(user1)).to.equal(TRAP);
      await ext.transfer(user1, TRAP);
      await ext.transfer(lp, ProtectionConfig.TokensToPutIntoLiquidityPool, GAS_LIMIT);
      await skipBlocks(300);
      await ext.connect(lpSigner).transfer(user1, TRAP);
      await ext.connect(user1Signer).transfer(lp, TRAP);
      await expect(ext.connect(user1Signer).revokeBlocked([user1, user2, user3], revoker))
          .to.be.reverted;
    });


    it('Should trap all buyers in the first block', async function() {
      await stopMining();
      await addToBlock(() => ext.transfer(lp, ProtectionConfig.TokensToPutIntoLiquidityPool, GAS_LIMIT));
      await addToBlock(() => ext.transfer(user2, 1, GAS_LIMIT));
      await addToBlock(() => ext.transfer(user3, 2, GAS_LIMIT));
      // Block user1.
      await addToBlock(() => ext.connect(lpSigner).transfer(user1, 3, GAS_LIMIT));
      // Should be blocked in the next block.
      await addToBlock(() => ext.connect(user1Signer).transfer(user2, 2, GAS_LIMIT));
      // Sells are not blocked.
      await addToBlock(() => ext.connect(user2Signer).transfer(lp, 1, GAS_LIMIT));
      await addToBlock(() => ext.connect(user3Signer).transfer(user2, 1, GAS_LIMIT));
      await mine();
      await startMining();
      await expect(ext.connect(user1Signer).transfer(user3, 1))
          .to.be.revertedWith('FirstBlockTrap: blocked');
      expect(await ext.balanceOf(user1)).to.equal(1);
      expect(await ext.balanceOf(user2)).to.equal(3);
      expect(await ext.balanceOf(user3)).to.equal(1);
      await ext.connect(lpSigner).transfer(user1, 1);
      await ext.connect(lpSigner).transfer(user2, 1);
      await ext.connect(user2Signer).transfer(lp, 1);
      await ext.connect(lpSigner).transfer(user3, 1);
      await ext.connect(user3Signer).transfer(lp, 1);

      await ext.revokeBlocked([user1, user2, user3], revoker);
      expect(await ext.balanceOf(revoker)).to.equal(2);
      expect(await ext.balanceOf(user1)).to.equal(0);
      expect(await ext.balanceOf(user2)).to.equal(3);
      expect(await ext.balanceOf(user3)).to.equal(1);
    });

    it('Should trap all buyers who bought above amount limit', async function() {
      await (await ext.transfer(lp, ProtectionConfig.TokensToPutIntoLiquidityPool, GAS_LIMIT)).wait();
      await skipBlocks(ProtectionConfig.LiquidityAmountTrap_blocks - 3);
      await stopMining();
      await addToBlock(() => ext.transfer(user2, 1, GAS_LIMIT));
      await addToBlock(() => ext.transfer(user3, 2, GAS_LIMIT));
      await addToBlock(() => ext.connect(lpSigner).transfer(user1, TRAP - 2n, GAS_LIMIT));
      await addToBlock(() => ext.connect(lpSigner).transfer(user2, TRAP - 1n, GAS_LIMIT));
      // Block user3 in the next block.
      const tx1 = await addToBlock(() => ext.connect(lpSigner).transfer(user3, TRAP, GAS_LIMIT));
      await addToBlock(() => ext.connect(lpSigner).transfer(user3, 1, GAS_LIMIT));
      // Transfers are not counted.
      await addToBlock(() => ext.connect(user1Signer).transfer(user2, 2, GAS_LIMIT));
      // Sells are not counted.
      await addToBlock(() => ext.connect(user2Signer).transfer(lp, 1, GAS_LIMIT));
      // Should not be blocked in the same block.
      await addToBlock(() => ext.connect(user3Signer).transfer(user2, 1, GAS_LIMIT));
      await mine();
      // Should be blocked.
      const tx2 = await addToBlock(() => ext.connect(user3Signer).transfer(user2, 1, GAS_LIMIT));
      await addToBlock(() => ext.connect(lpSigner).transfer(user1, 1, GAS_LIMIT));
      // Block user2.
      const tx3 = await addToBlock(() => ext.connect(lpSigner).transfer(user2, 1, GAS_LIMIT));
      await mine();
      await startMining();
      await expect(tx1).to.emit(lps, 'Blocked').withArgs(lp, user3, 'LiquidityAmountTrap');
      await expect(tx2.wait()).to.be.reverted;
      await expect(tx3).to.emit(lps, 'Blocked').withArgs(lp, user2, 'LiquidityAmountTrap');
      await expect(ext.connect(user2Signer).transfer(user1, 1))
          .to.be.revertedWith('LiquidityAmountTrap: blocked');
      await expect(ext.connect(user3Signer).transfer(user1, 1))
          .to.be.revertedWith('LiquidityAmountTrap: blocked');
      expect(await ext.balanceOf(user1)).to.equal(TRAP - 3n);
      expect(await ext.balanceOf(user2)).to.equal(TRAP + 3n);
      expect(await ext.balanceOf(user3)).to.equal(TRAP + 2n);
      await ext.connect(user1Signer).transfer(lp, 1);
      await ext.connect(lpSigner).transfer(user1, 1);
      await ext.connect(lpSigner).transfer(user2, 1);
      await ext.connect(lpSigner).transfer(user3, 1);
      // Should not block after blocks passed.
      await ext.connect(lpSigner).transfer(user1, TRAP);
      await ext.connect(user1Signer).transfer(lp, 1);

      await ext.revokeBlocked([user1, user2, user3], revoker);
      expect(await ext.balanceOf(revoker)).to.equal(TRAP + TRAP + 3n + 4n);
      expect(await ext.balanceOf(user1)).to.equal(TRAP + TRAP - 4n);
      expect(await ext.balanceOf(user2)).to.equal(0);
      expect(await ext.balanceOf(user3)).to.equal(0);
    });

    it('Should trap all buyers who bought above percent limit', async function() {
      let liquidity = ProtectionConfig.TokensToPutIntoLiquidityPool;
      await (await ext.transfer(lp, liquidity*1n/4n, GAS_LIMIT)).wait();
      liquidity -= liquidity*3n/4n;
      await stopMining();
      await addToBlock(() => ext.transfer(user2, 1, GAS_LIMIT));
      await addToBlock(() => ext.transfer(user3, 2, GAS_LIMIT));
      await addToBlock(() => ext.connect(lpSigner).transfer(user1, liquidity * PERCENT_TRAP / HUNDRED_PERCENT - 2n, GAS_LIMIT));
      liquidity -= liquidity * PERCENT_TRAP / HUNDRED_PERCENT - 2n;
      await addToBlock(() => ext.connect(lpSigner).transfer(user2, liquidity * PERCENT_TRAP / HUNDRED_PERCENT - 1n, GAS_LIMIT));
      liquidity -= liquidity * PERCENT_TRAP / HUNDRED_PERCENT - 1n;
      // Block user3.
      const tx1 = await addToBlock(() => ext.connect(lpSigner).transfer(user3, liquidity * PERCENT_TRAP / HUNDRED_PERCENT + 1n, GAS_LIMIT));
      liquidity -= liquidity * PERCENT_TRAP / HUNDRED_PERCENT + 1n;
      await addToBlock(() => ext.connect(lpSigner).transfer(user3, 1, GAS_LIMIT));
      liquidity -= 1n;
      // Transfers are not counted.
      await addToBlock(() => ext.connect(user1Signer).transfer(user2, 2, GAS_LIMIT));
      // Sells are not counted.
      await addToBlock(() => ext.connect(user2Signer).transfer(lp, 1, GAS_LIMIT));
      liquidity += 1n;
      // Should not be blocked yet.
      await addToBlock(() => ext.connect(user3Signer).transfer(user2, 1, GAS_LIMIT));
      await mine();
      // Should be blocked.
      const tx2 = await addToBlock(() => ext.connect(user3Signer).transfer(user2, 1, GAS_LIMIT));
      await mine();
      await addToBlock(() => ext.connect(lpSigner).transfer(user1, liquidity * PERCENT_TRAP / HUNDRED_PERCENT - 2n, GAS_LIMIT));
      liquidity -= liquidity * PERCENT_TRAP / HUNDRED_PERCENT - 2n;
      await addToBlock(() => ext.connect(lpSigner).transfer(user2, liquidity * PERCENT_TRAP / HUNDRED_PERCENT - 1n, GAS_LIMIT));
      liquidity -= liquidity * PERCENT_TRAP / HUNDRED_PERCENT - 1n;
      // Block user2.
      const tx3 = await addToBlock(() => ext.connect(lpSigner).transfer(user2, liquidity / 100n, GAS_LIMIT));
      liquidity -= liquidity / 100n;
      await mine();
      await startMining();
      await expect(tx1).to.emit(lps, 'Blocked').withArgs(lp, user3, 'LiquidityPercentTrap');
      await expect(tx2.wait()).to.be.reverted;
      await expect(tx3).to.emit(lps, 'Blocked').withArgs(lp, user2, 'LiquidityPercentTrap');
      await expect(ext.connect(user2Signer).transfer(user1, 1))
          .to.be.revertedWith('LiquidityPercentTrap: blocked');
      await expect(ext.connect(user3Signer).transfer(user1, 1))
          .to.be.revertedWith('LiquidityPercentTrap: blocked');
      expect(await ext.balanceOf(lp)).to.equal(liquidity);
      await ext.connect(user1Signer).transfer(lp, 1);
      await ext.connect(lpSigner).transfer(user1, 1);
      await ext.connect(lpSigner).transfer(user2, 1);
      await ext.connect(lpSigner).transfer(user3, 1);

      await ext.revokeBlocked([user1, user2, user3], revoker);
      expect(await ext.balanceOf(revoker)).to.not.equal(0);
      expect(await ext.balanceOf(user1)).to.not.equal(0);
      expect(await ext.balanceOf(user2)).to.equal(0);
      expect(await ext.balanceOf(user3)).to.equal(0);
    });



    it('Should trap all traders if more than 8 trades in the second block', async function() {
      if (ProtectionConfig.LiquidityActivityTrap_skip) {
        console.log('LiquidityActivityTrap disabled.');
        return;
      }
      await (await ext.transfer(lp, ProtectionConfig.TokensToPutIntoLiquidityPool, GAS_LIMIT)).wait();
      await mine();
      await stopMining();
      await addToBlock(() => ext.connect(lpSigner).transfer(user1, 100, GAS_LIMIT));
      await addToBlock(() => ext.connect(user1Signer).transfer(user2, 10, GAS_LIMIT));
      // Simple transfers are not counted.
      await addToBlock(() => ext.connect(user1Signer).transfer(user3, 10, GAS_LIMIT));
      await addToBlock(() => ext.connect(user3Signer).transfer(user1, 5, GAS_LIMIT));
      // User2 traded.
      await addToBlock(() => ext.connect(user2Signer).transfer(lp, 5, GAS_LIMIT));
      for (let i = 0; i < ProtectionConfig.LiquidityActivityTrap_count - 2; i++) {
        await addToBlock(() => ext.connect(lpSigner).transfer(user1, 10, GAS_LIMIT));
      }
      // 16th tx block the sell (reverted).
      const tx = await addToBlock(() => ext.connect(user1Signer).transfer(lp, 10, GAS_LIMIT));
      // 16th tx block the block.
      await addToBlock(() => ext.connect(lpSigner).transfer(user1, 10, GAS_LIMIT));
      await mine();
      await startMining();
      await expect(tx.wait()).to.be.reverted;
      await expect(ext.connect(user2Signer).transfer(user1, 1))
          .to.be.revertedWith('LiquidityActivityTrap: blocked');
      await expect(ext.connect(user1Signer).transfer(owner, 1))
          .to.be.revertedWith('LiquidityActivityTrap: blocked');
      await ext.connect(user3Signer).transfer(user1, 1);
      await ext.connect(lpSigner).transfer(user1, 1);
      await ext.connect(lpSigner).transfer(user2, 1);
      await ext.connect(lpSigner).transfer(user3, 1);

      await ext.revokeBlocked([user1, user2, user3], revoker);
      expect(await ext.balanceOf(revoker)).to.equal(97 + (10*(ProtectionConfig.LiquidityActivityTrap_count - 2)) + 6);
      expect(await ext.balanceOf(user1)).to.equal(0);
      expect(await ext.balanceOf(user2)).to.equal(0);
      expect(await ext.balanceOf(user3)).to.equal(5);
    });

    it('Should trap all traders if more than 8 trades in the third block, but do not trap second block traders', async function() {
      if (ProtectionConfig.LiquidityActivityTrap_skip) {
        console.log('LiquidityActivityTrap disabled.');
        return;
      }
      await (await ext.transfer(lp, ProtectionConfig.TokensToPutIntoLiquidityPool, GAS_LIMIT)).wait();
      await stopMining();
      await addToBlock(() => ext.connect(lpSigner).transfer(user1, 100, GAS_LIMIT));
      await addToBlock(() => ext.connect(user1Signer).transfer(user2, 10, GAS_LIMIT));
      // Simple transfers are not counted.
      await addToBlock(() => ext.connect(user1Signer).transfer(user3, 10, GAS_LIMIT));
      await addToBlock(() => ext.connect(user3Signer).transfer(user1, 5, GAS_LIMIT));
      // User2 traded.
      await addToBlock(() => ext.connect(user2Signer).transfer(lp, 5, GAS_LIMIT));
      for (let i = 0; i < ProtectionConfig.LiquidityActivityTrap_count - 2; i++) {
        await addToBlock(() => ext.connect(lpSigner).transfer(user1, 10, GAS_LIMIT));
      }
      await mine();
      for (let i = 0; i < ProtectionConfig.LiquidityActivityTrap_count + 1; i++) {
        await addToBlock(() => ext.connect(lpSigner).transfer(user1, 10, GAS_LIMIT));
      }
      await mine();
      await startMining();
      await expect(ext.connect(user1Signer).transfer(owner, 1))
          .to.be.revertedWith('LiquidityActivityTrap: blocked');
      await ext.connect(user2Signer).transfer(user1, 1);
      await ext.connect(user3Signer).transfer(user1, 1);
      await ext.connect(lpSigner).transfer(user1, 1);
      await ext.connect(lpSigner).transfer(user2, 1);
      await ext.connect(lpSigner).transfer(user3, 1);

      await ext.revokeBlocked([user1, user2, user3], revoker);
      expect(await ext.balanceOf(revoker)).to.not.equal(0);
      expect(await ext.balanceOf(user1)).to.equal(0);
      expect(await ext.balanceOf(user2)).to.not.equal(0);
      expect(await ext.balanceOf(user3)).to.not.equal(0);
    });

    it('Should not trap traders after activity blocks passed', async function() {
      if (ProtectionConfig.LiquidityActivityTrap_skip) {
        console.log('LiquidityActivityTrap disabled.');
        return;
      }
      await (await ext.transfer(lp, ProtectionConfig.TokensToPutIntoLiquidityPool, GAS_LIMIT)).wait();
      await skipBlocks(ProtectionConfig.LiquidityActivityTrap_blocks);
      await stopMining();
      await addToBlock(() => ext.connect(lpSigner).transfer(user1, 100, GAS_LIMIT));
      await addToBlock(() => ext.connect(user1Signer).transfer(user2, 10, GAS_LIMIT));
      await addToBlock(() => ext.connect(user1Signer).transfer(user3, 10, GAS_LIMIT));
      await addToBlock(() => ext.connect(user3Signer).transfer(user1, 5, GAS_LIMIT));
      // User2 traded.
      await addToBlock(() => ext.connect(user2Signer).transfer(lp, 5, GAS_LIMIT));
      for (let i = 0; i < ProtectionConfig.LiquidityActivityTrap_count + 1; i++) {
        await addToBlock(() => ext.connect(lpSigner).transfer(user1, 10, GAS_LIMIT));
      }
      await mine();
      await startMining();
      await ext.connect(user1Signer).transfer(user2, 1);
      await ext.connect(user2Signer).transfer(user1, 1);
      await ext.connect(user3Signer).transfer(user1, 1);
      await ext.connect(lpSigner).transfer(user1, 1);
      await ext.connect(lpSigner).transfer(user2, 1);
      await ext.connect(lpSigner).transfer(user3, 1);

      await ext.revokeBlocked([user1, user2, user3], revoker);
      expect(await ext.balanceOf(revoker)).to.equal(0);
      expect(await ext.balanceOf(user1)).to.not.equal(0);
      expect(await ext.balanceOf(user2)).to.not.equal(0);
      expect(await ext.balanceOf(user3)).to.not.equal(0);
    });

    it('Should disable protection', async function() {
      await stopMining();
      await addToBlock(() => ext.transfer(lp, ProtectionConfig.TokensToPutIntoLiquidityPool, GAS_LIMIT));
      await addToBlock(() => ext.transfer(user2, 1, GAS_LIMIT));
      await addToBlock(() => ext.transfer(user3, 2, GAS_LIMIT));
      // Block user1.
      await addToBlock(() => ext.connect(lpSigner).transfer(user1, 3, GAS_LIMIT));
      // Should be blocked.
      await addToBlock(() => ext.connect(user1Signer).transfer(user2, 2, GAS_LIMIT));
      // Sells are not blocked.
      await addToBlock(() => ext.connect(user2Signer).transfer(lp, 1, GAS_LIMIT));
      await addToBlock(() => ext.connect(user3Signer).transfer(user2, 1, GAS_LIMIT));
      await mine();
      await startMining();
      await expect(ext.connect(user1Signer).transfer(user3, 1))
        .to.be.revertedWith('FirstBlockTrap: blocked');
      await expect(ext.connect(user1Signer).disableProtection())
        .to.be.reverted;
      await setTimeAndMine(1639785599)
      await ext.connect(user1Signer).transfer(user3, 1);
      await ext.connect(lpSigner).transfer(user1, 1);
      await ext.connect(lpSigner).transfer(user2, 1);
      await ext.connect(user2Signer).transfer(lp, 1);
      await ext.connect(lpSigner).transfer(user3, 1);
      await ext.connect(user3Signer).transfer(lp, 1);
      ext.disableProtection();
      await expect(ext.revokeBlocked([user1, user2, user3], revoker))
        .to.be.revertedWith('UsingLiquidityProtectionService: protection removed');
    });
  });

});
