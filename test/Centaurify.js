const Centaurify = artifacts.require('Centaurify');
const VestingVault = artifacts.require("VestingVault");

require('chai')
  .should()
  .assert;
  
contract('Centaurify', accounts => {
  const _name = 'Centaurify';
  const _symbol = 'CENT';
  const _decimals = 9;
  const _totalSupply = 1000000000;

  let token, vestingToken;
  beforeEach(async () => {
    token = await Centaurify.deployed();
    vestingToken = await VestingVault.deployed();
  });

  describe('Initial State', () => {
    
    it('has the correct name', async () => {
      const name = await token.name();
      assert.equal(name, _name);
    });

    it('has the correct symbol', async () => {
      const symbol = await token.symbol();
      assert.equal(symbol, _symbol);
    });

    it('has the correct decimals', async () => {
      const decimals = await token.decimals();
      assert.equal(decimals.toNumber(), _decimals);
    });

    it('has the correct total supply', async () => {
      const totalSupply = await token.totalSupply();
      assert.equal(totalSupply / 10**_decimals, _totalSupply);
    });

    it('has the correct owner', async () => {
      const owner = await token.owner();
      assert.equal(owner, accounts[0]);
    });

    it('owner has the total supply initially', async () => {
      const ownerBalance = await token.balanceOf(accounts[0]);
      assert.equal(ownerBalance / 10**_decimals, _totalSupply * 50 / 100);
    });

  });

  describe('Token transfer', async () => {

    it('transfer', async () => {
      let senderInitialBalance = await token.balanceOf(accounts[0]) / 10 ** _decimals;
      let recipientInitialBalance = await token.balanceOf(accounts[1]) / 10**_decimals;
      let amount = 100;

      let response = await token.transfer(accounts[1], amount * 10**_decimals, { from: accounts[0] });
      assert.property(response, 'tx');
      assert.property(response, 'receipt', { status: true });

      let senderBalance = await token.balanceOf(accounts[0]) / 10**_decimals;
      let recipientBalance = await token.balanceOf(accounts[1]) / 10**_decimals;
      assert.equal(senderBalance, senderInitialBalance - amount);
      assert.equal(recipientBalance, recipientInitialBalance + amount);
    });

    it('transfer with fee', async () => {
      let senderInitialBalance = await token.balanceOf(accounts[1]) / 10**_decimals;
      let recipientInitialBalance = await token.balanceOf(accounts[2]) / 10**_decimals;
      let amount = 10;

      let response = await token.transfer(accounts[2], amount * 10**_decimals, { from: accounts[1] });
      assert.property(response, 'tx');
      assert.property(response, 'receipt', { status: true });

      let senderBalance = await token.balanceOf(accounts[1]) / 10**_decimals;
      let recipientBalance = await token.balanceOf(accounts[2]) / 10**_decimals;
      assert.isAtLeast(senderBalance, senderInitialBalance - amount);
      assert.isAtLeast(recipientBalance, recipientInitialBalance + (amount - (amount * 10 / 100)));
    });

  it('transfer from before approval', async () => {
      try {
        await token.transferFrom(accounts[0], accounts[2], 10 * 10 ** _decimals, { from: accounts[1] });
      }
      catch (err) {
        const errorMessage = "ERC20: transfer amount exceeds allowance"
        assert.equal(err.reason, errorMessage);
      }
    });

    it('approve', async () => {
      await token.approve(accounts[1], 10 * 10 ** _decimals, { from: accounts[0] });
      let allowance = await token.allowance(accounts[0], accounts[1]);
      assert.equal(allowance / 10**_decimals, 10);
    });

    it('transfer from after approval', async () => {
      let response = await token.transferFrom(accounts[0], accounts[2], 10 * 10 ** _decimals, { from: accounts[1] });
      assert.property(response, 'tx');
      assert.property(response, 'receipt', { status: true });
    });

  });

  describe('Burn token', async () => {
    it('burn token', async () => {
      let burn_amount = 1;
      let response = await token.transfer(accounts[0], burn_amount * 10**_decimals, { from: accounts[0] });
      assert.property(response, 'tx');
      assert.property(response, 'receipt', { status: true });
    
      const totalSupply = await token.totalSupply();
      assert.isAtLeast(totalSupply / 10**_decimals, _totalSupply - burn_amount);
    })
  })

  describe('Exclude / Include address', async () => {

    it('exclude from reward', async () => {
      await token.excludeFromReward(accounts[1]);
      assert.isTrue(await token.isExcludedFromReward(accounts[1]));
    });

    it('include in reward', async () => {
      await token.includeInReward(accounts[1]);
      assert.isFalse(await token.isExcludedFromReward(accounts[1]));
    });

    it('exclude from fee', async () => {
      await token.excludeFromFee(accounts[1]);
      assert.isTrue(await token.isExcludedFromFee(accounts[1]));
    })

    it('include in fee', async () => {
      await token.includeInFee(accounts[1]);
      assert.isFalse(await token.isExcludedFromFee(accounts[1]));
    });

  });

  describe('Set values', async () => {

    it('setTaxFeePercent', async () => {
      let percentage = 1;
      await token.setTaxFeePercent(percentage);
      assert.equal(await token._taxFee(), percentage);
    });

    it('setTaxFeePercent not by the owner', async () => {
      try {
        let percentage = 1;
        await token.setTaxFeePercent(percentage, {from: accounts[1]});
      } catch (err) {
        const errorMessage = "Ownable: caller is not the owner"
        assert.equal(err.reason, errorMessage);
      }
    });

    it('setLiquidityFeePercent', async () => {
      let percentage = 1;
      await token.setLiquidityFeePercent(percentage);
      assert.equal(await token._liquidityFee(), percentage);
    });

    it('setLiquidityFeePercent not by the owner', async () => {
      try {
        let percentage = 1;
        await token.setLiquidityFeePercent(percentage, {from: accounts[1]});
      } catch (err) {
        const errorMessage = "Ownable: caller is not the owner"
        assert.equal(err.reason, errorMessage);
      }
    });

    it('setBurnPercent', async () => {
      let percentage = 1;
      await token.setBurnPercent(percentage);
      assert.equal(await token._transactionBurn(), percentage);
    });

    it('setBurnPercent not by the owner', async () => {
      try {
        let percentage = 1;
        await token.setBurnPercent(percentage, {from: accounts[1]});
      } catch (err) {
        const errorMessage = "Ownable: caller is not the owner"
        assert.equal(err.reason, errorMessage);
      }
    });

    it('setMarketingFeePercent', async () => {
      let percentage = 1;
      await token.setMarketingFeePercent(percentage);
      assert.equal(await token._marketingFee(), percentage);
    });

    it('setMarketingFeePercent not by the owner', async () => {
      try {
        let percentage = 1;
        await token.setMarketingFeePercent(percentage, {from: accounts[1]});
      } catch (err) {
        const errorMessage = "Ownable: caller is not the owner"
        assert.equal(err.reason, errorMessage);
      }
    });

    it('setMaxTxPercent', async () => {
      let percentage = 1;
      await token.setMaxTxPercent(percentage);
      assert.equal(await token._maxTxAmount() / 10**_decimals, _totalSupply * percentage / 100);
    });

    it('setMaxTxPercent not by the owner', async () => {
      try {
        let percentage = 1;
        await token.setMaxTxPercent(percentage, {from: accounts[1]});
      } catch (err) {
        const errorMessage = "Ownable: caller is not the owner"
        assert.equal(err.reason, errorMessage);
      }
    });

    it('setSwapAndLiquifyEnabled', async () => {
      await token.setSwapAndLiquifyEnabled(true);
      assert.isTrue(await token.swapAndLiquifyEnabled());
    });

    it('setSwapAndLiquifyEnabled not by the owner', async () => {
      try {
        await token.setSwapAndLiquifyEnabled(true, {from: accounts[1]});
      } catch (err) {
        const errorMessage = "Ownable: caller is not the owner"
        assert.equal(err.reason, errorMessage);
      }
    });

    it('setFeeInETH', async () => {
      await token.setFeeInETH(true);
      assert.isTrue(await token._feeInETH());
    });

    it('setFeeInETH not by the owner', async () => {
      try {
        await token.setFeeInETH(true, {from: accounts[1]});
      } catch (err) {
        const errorMessage = "Ownable: caller is not the owner"
        assert.equal(err.reason, errorMessage);
      }
    });

    it('setVestingAddress', async () => {
      await token.setVestingAddress(vestingToken.address);
      assert.equal(await token.vesting_address(), vestingToken.address);
    });

  })

  describe('Allowance', async () => {

    it('allowance', async () => {
      let allowance = await token.allowance(accounts[0], accounts[2]);
      assert.equal(allowance / 10**_decimals, 0);
    });

    it('increaseAllowance', async () => {
      let increaseAmount = 10;
      await token.increaseAllowance(accounts[2], increaseAmount * 10 ** _decimals, {from: accounts[0]});
      let allowance = await token.allowance(accounts[0], accounts[2]);
      assert.equal(allowance / 10**_decimals, increaseAmount);
    });

    it('decreaseAllowance', async () => {
      let decreaseAmount = 1;
      await token.decreaseAllowance(accounts[2], decreaseAmount * 10 ** _decimals, { from: accounts[0] });
      let allowance = await token.allowance(accounts[0], accounts[2]);
      assert.equal(allowance / 10**_decimals, 9);
    });

    it('crowdsaleApprove', async () => {
      let increaseAmount = 10;
      await token.crowdsaleApprove(accounts[0], increaseAmount * 10 ** _decimals);
      let allowance = await token.allowance(accounts[0], await token.vesting_address());
      assert.equal(allowance / 10**_decimals, increaseAmount);
    });

  });

});