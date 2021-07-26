const Centaurify = artifacts.require('Centaurify');

require('chai')
  .should()
  .assert;
  
contract('Centaurify', accounts => {
  const _name = 'Centaurify';
  const _symbol = 'CENT';
  const _decimals = 9;
  const _totalSupply = 1000000000;

  let token;
  beforeEach(async function () {
    token = await Centaurify.deployed();
  });

  describe('Initial State', function () {
    
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

    it('has the correct owner', async () => {
      const owner = await token.owner();
      assert.equal(owner, accounts[0]);
    });

  });
});