// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./Crowdsale.sol";
import "./Vesting.sol";
import "./TimedCrowdsale.sol";
import "./WhitelistedCrowdsale.sol";
import "./FinalizableCrowdsale.sol";
import "./abstracts/Ownable.sol";

contract TokenSale is Crowdsale, TimedCrowdsale, WhitelistedCrowdsale, FinalizableCrowdsale {

    VestingVault vestingToken;
    constructor(
        uint256 rate,            // rate, in TKNbits
        address payable wallet,  // wallet to send Ether
        ERC20 token,             // the token
        VestingVault vesting,    // the token
        uint256 openingTime,     // opening time in unix epoch seconds
        uint256 closingTime      // closing time in unix epoch seconds
    )
        WhitelistedCrowdsale()
        TimedCrowdsale(openingTime, closingTime)
        Crowdsale(rate, wallet, token)
        public
    {
        vestingToken = vesting;
    }

    /**
        * @dev low level token purchase ***DO NOT OVERRIDE***
        * @param _beneficiary Address performing the token purchase
        */
    function buyToken(address _beneficiary) external payable onlyWhileOpen isWhitelisted(_beneficiary) {
        buyTokens(_beneficiary);
        // calculate token amount to be created
        uint256 token_amount = _getTokenAmount(msg.value);
        uint256 tokens = token_amount - token_amount * 10 / 100;

        // Dev comments - For development _vestingDurationInMonths is set to 10 months and _lockDurationInMonths to 1 month
        vestingToken.addTokenGrant(_beneficiary, tokens, 10, 1);
    }

    function finalization() virtual internal override {
        uint256 balance = token.balanceOf(address(this));
        token.transfer(owner(), balance);
    }

    function extendSale(uint256 newClosingTime) virtual external onlyOwner {
        _extendTime(newClosingTime);
    }

    function changeRate(uint256 newRate) virtual external onlyOwner {
        _changeRate(newRate);
    }
}