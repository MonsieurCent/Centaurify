const Centaurify = artifacts.require('Centaurify');
const vesting = artifacts.require('VestingVault');
const TokenSale = artifacts.require("TokenSale");
const fetch = require("node-fetch");


require('chai')
    .should()
    .assert;

const SECONDS_IN_DAY = 86400;

contract('vesting', async accounts =>{
    // const centaurify_token = await Centaurify.deployed();

    it("owner adding crowdsale address", async () => {
        const vest = await vesting.deployed();
        const token_sale = await TokenSale.deployed();
        await vest.addCrowdsaleAddress(token_sale.address);
        assert.equal(await vest.crowdsale_address.call(), token_sale.address);
    });

    it("non owner adding crowdsale address", async () => {
        const vest = await vesting.deployed();
        try{
            await vest.addCrowdsaleAddress('0x74c78f2Db1A7f2aAB569641E302605c0a615883B',{from: 0x2CBc460fc2117872a59d4dc4cA15893994C5527a});
        }
        catch (err){
            const errorMessage = "Ownable: caller is not the owner"
            assert.equal(err.reason, errorMessage, "crowdsale address should not be changed by non owner");
        }
    });

    it("checking the vesting duration in months not greater than 25 years", async() =>{
        const vest = await vesting.deployed();
        try{
            await vest.addTokenGrant(accounts[0], 100, 26*12,9*12);
        }
        catch (err){
            const errorMessage = "Duration greater than 25 years"
            assert.equal(err.reason, errorMessage);
        }
    });

    it("checking the lock duration not greater than 10 years", async() =>{
        const vest = await vesting.deployed();
        try{
            await vest.addTokenGrant(accounts[0], 100, 25*12,11*12);
        }
        catch (err){
            const errorMessage = "Lock greater than 10 years"
            assert.equal(err.reason, errorMessage);
        }
    });

    it("Grant amount cannot be 0", async() =>{
        const vest = await vesting.deployed();
        try{
            await vest.addTokenGrant(accounts[0], 0, 25*12,10*12);
        }
        catch (err){
            const errorMessage = "Grant amount cannot be 0"
            assert.equal(err.reason, errorMessage);
        }
    });

    it("amountVestedPerMonth > 0", async() =>{
        const vest = await vesting.deployed();
        try{
            await vest.addTokenGrant(accounts[0], 9, 25*12,10*12);
        }
        catch (err){
            const errorMessage = "amountVestedPerMonth > 0"
            assert.equal(err.reason, errorMessage);
        }
    });

    it("Grant already exists, must revoke first.", async() =>{
        const vest = await vesting.deployed();
        const centaurify_token = await Centaurify.deployed();
        try{
            await centaurify_token.setVestingAddress(vest.address)
            await vest.addTokenGrant(accounts[0], 1000, 10,1, {from: accounts[0]}); // adding first time
            await centaurify_token.approve(accounts[1],10000, {from: accounts[0]});
            await centaurify_token.transfer(accounts[1],1000, {from: accounts[0]});
            await vest.addTokenGrant(accounts[1], 1000, 10,1, {from: accounts[1]});
            await vest.addTokenGrant(accounts[0], 1000, 25*12,10*12, {from: accounts[0]}); // adding second time
        }
        catch (err){
            const errorMessage = "Grant already exists, must revoke first."
            assert.equal(err.reason, errorMessage);
        }
    });

    it("checking amount vested by forwarding time in 1 month", async() =>{
        const vest = await vesting.deployed();
        const now = new Date();

        // 31 Days time forwarding
        await fetch("http://localhost:8545", {
            body: '{"id":1337,"jsonrpc":"2.0","method":"evm_increaseTime","params":['+SECONDS_IN_DAY*31+']}',
            headers: {
                "Content-Type": "application/json"
            },
            method: "POST"
        });

        // mining the block
        await fetch("http://localhost:8545", {
            body: '{"id":1337,"jsonrpc":"2.0","method":"evm_mine"}',
            headers: {
                "Content-Type": "application/json"
            },
            method: "POST"
        })

        let res  = await vest.calculateGrantClaim(accounts[0]);

        assert.equal(res[1].toNumber(),100)
    });

    it("Claim vested tokens", async() =>{
        const vest = await vesting.deployed();
        const centaurify_token = await Centaurify.deployed();
        await vest.claimVestedTokens({from: accounts[1]}); //caliming the vested token
        let balance = await centaurify_token.balanceOf(accounts[1]);
        assert.equal(parseFloat(balance),100);
    });

    it("Revoking the tokens from vesting", async() =>{
        const vest = await vesting.deployed();
        const token_sale = await TokenSale.deployed();
        const centaurify_token = await Centaurify.deployed();
        await vest.addCrowdsaleAddress(token_sale.address,{from: accounts[0]});
        await vest.revokeTokenGrant(accounts[1],{from: accounts[1]}); //revoking the vesting
        let balance = await centaurify_token.balanceOf(accounts[1]);
        assert.equal(parseFloat(balance),900);
    });
});