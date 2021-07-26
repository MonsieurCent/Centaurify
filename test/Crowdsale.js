const Centaurify = artifacts.require('Centaurify');
const VestingVault = artifacts.require("VestingVault");
const TokenSale = artifacts.require("TokenSale");

require('chai')
  .should()
  .assert;
  
contract('Token Sale', accounts => {

    let token, tokensale;
    beforeEach(async () => {
        token = await Centaurify.deployed();
        vestingToken = await VestingVault.deployed();
        tokensale = await TokenSale.deployed();
    });

    it('whitelist an account', async () => {
        await tokensale.addToWhitelist(accounts[1], {from: accounts[0]});
        assert.isTrue(await tokensale.whitelist(accounts[1]));
    });

    it('whitelist an account from a non owner account', async () => {
        try {
            await tokensale.addToWhitelist(accounts[1], { from: accounts[1] });
        } catch (err) {
            const errorMessage = "Ownable: caller is not the owner"
            assert.equal(err.reason, errorMessage);
        }
    });

    it('whitelist many accounts', async () => {
        await tokensale.addManyToWhitelist([accounts[2], accounts[3]], { from: accounts[0] });
        assert.isTrue(await tokensale.whitelist(accounts[2]));
        assert.isTrue(await tokensale.whitelist(accounts[3]));
    });

    it('whitelist an account from a non owner account', async () => {
        try {
            await tokensale.addManyToWhitelist([accounts[2], accounts[3]], { from: accounts[1] });
        } catch (err) {
            const errorMessage = "Ownable: caller is not the owner"
            assert.equal(err.reason, errorMessage, "address should not be whitelisted by non owner");
        }
    });

    it('remove an account from whitelist', async () => {
        await tokensale.removeFromWhitelist(accounts[3], {from: accounts[0]});
        assert.isFalse(await tokensale.whitelist(accounts[3]));
    });

    it('remove an account from whitelist from a non owner account', async () => {
        try {
            await tokensale.addToWhitelist(accounts[3], { from: accounts[1] });
        } catch (err) {
            const errorMessage = "Ownable: caller is not the owner"
            assert.equal(err.reason, errorMessage, "address should not be whitelisted by non owner");
        }
    });

    // it('Buy tokens', async () => {
    //     await token.setVestingAddress(vestingToken.address);
    //     let response = await tokensale.buyToken(accounts[1], { from: accounts[1], value: 1 });
    //     assert.property(response, 'tx');
    //     assert.property(response, 'receipt', { status: true });
    // });

    it('Extend crowdsale time', async () => {
        let closingTime = await tokensale.closingTime();
        await tokensale.extendSale(closingTime + 5 * 60, { from: accounts[0] });  // extend by 5 mins
        assert.equal(await tokensale.closingTime(), closingTime + 5 * 60);
    });

    it('Extend crowdsale time with wrong time', async () => {
        try {
            let closingTime = await tokensale.closingTime();
            await tokensale.extendSale(closingTime - 5 * 60);
        } catch (err) {
            const errorMessage = "TimedCrowdsale: new closing time is before current closing time"
            assert.equal(err.reason, errorMessage);
        }
    });

    it('Extend crowdsale time by non owner', async () => {
        try {
            let closingTime = await tokensale.closingTime();
            await tokensale.extendSale(closingTime + 5 * 60, { from: accounts[1] });  // extend by 5 mins
        } catch (err) {
            const errorMessage = "Ownable: caller is not the owner"
            assert.equal(err.reason, errorMessage);
        }
    });

});