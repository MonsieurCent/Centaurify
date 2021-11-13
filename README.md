# Centaurify (CENT) With Liquidity Protection Service

##Details

---

#### Centaurify (CENT) Protection parameters


User LiquidityProtectionsService address in the integrated token UsingLiquidityProtectionService.liquidityProtectionsService() override

    Current CENT LiquidityProtectionsService mainnet address: 0x8BC02aaC27aE0E5d33bB362673f41aFfB9CF735b

Switch off protection outomaticaly on Friday, December 17, 2021 11:59:59 PM GMT

[comment]: <> (>Epoch timestamp: 1639785599)

---
#####FirstBlockTrap On
block all users who buy tokens in the same block with pair creation transaction

---

#####LiquidityAmountTrap On
    LiquidityAmountTrap_blocks 5
    LiquidityAmountTrap_amount 296000
block every user who buys in total more than 296000 tokens during the 5 first blocks after pair creation

---

#####LiquidityPercentTrap On
    LiquidityPercentTrap_blocks 6
    LiquidityPercentTrap_percent 4%
block every user who buys more than 4% of current liquidity in one transaction, limitation works during the 6 blocks

---

#####LiquidityActivityTrap On
    LiquidityActivityTrap_blocks 3
    LiquidityActivityTrap_count 8
will block all users who buy tokens if in the same block was more than 8 transaction, limitation works during the 3 blocks

---

###====================

## Installation

    npm install
    npm run compile

## Testing on mainnet fork

    npm run test -- --network hardhat

## Deployment

    Set target network node url, deployer private key in the hardhat.config.js.

    npm run hardhat -- --network target deploy

## etherscan.io verification

    Set API key for etherscan in the hardhat.config.js.
[https://etherscan.io/myapikey](https://etherscan.io/myapikey)

    npx hardhat verify --network target 0xTokenAddress

## Usage

Unblock accounts (must be done while protection is still on):

    npm run hardhat -- --network target unblock --token 0xTokenAddress --json ./blocked.example.json

Revoke tokens from blocked accounts (must be done while protection is still on):

    npm run hardhat -- --network target revoke-blocked --token 0xTokenAddress --to 0xRevokeToAddress --json ./blocked.example.json

Disable protection to make transfers cheaper:

    npm run hardhat -- --network target disableProtection --token 0xTokenAddress

Change the Liquidity Protection Service address:

    npm run hardhat -- --network target changeLPS --token 0xTokenAddress --lps 0xNewLpsAddress
