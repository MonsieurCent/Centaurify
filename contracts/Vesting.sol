// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./abstracts/Ownable.sol";

contract VestingVault is Ownable {
    using SafeMath for uint256;

    struct Grant {
        uint256 startTime;
        uint256 amount;
        uint256 vestingDuration;
        uint256 monthsClaimed;
        uint256 totalClaimed;
        address recipient;
    }

    event GrantAdded(address indexed recipient);
    event GrantTokensClaimed(address indexed recipient, uint256 amountClaimed);
    event GrantRevoked(address recipient, uint256 amountVested, uint256 amountNotVested);

    ERC20 immutable public token;
    
    mapping (address => Grant) private tokenGrants;

    address public crowdsale_address;

    constructor(ERC20 _token) {
        require(address(_token) != address(0));
        token = _token;
    }

    function addCrowdsaleAddress(address crowdsaleAddress) external onlyOwner {
        require(crowdsaleAddress != address(0), "ERC20: transfer from the zero address");
        crowdsale_address = crowdsaleAddress;
    }
    
    function addTokenGrant(
        address _recipient,
        uint256 _amount,
        uint256 _vestingDurationInMonths,
        uint256 _lockDurationInMonths    
    ) 
        external
    {
        require(tokenGrants[_recipient].amount == 0, "Grant already exists, must revoke first.");
        require(_vestingDurationInMonths <= 25*12, "Duration greater than 25 years");
        require(_lockDurationInMonths <= 10*12, "Lock greater than 10 years");
        require(_amount != 0, "Grant amount cannot be 0");
        uint256 amountVestedPerMonth = _amount.div(_vestingDurationInMonths);
        require(amountVestedPerMonth > 0, "amountVestedPerMonth < 0");

        Grant memory grant = Grant({
            startTime: currentTime().add(_lockDurationInMonths.mul(30 days)),
            amount: _amount,
            vestingDuration: _vestingDurationInMonths,
            monthsClaimed: 0,
            totalClaimed: 0,
            recipient: _recipient
        });
        tokenGrants[_recipient] = grant;
        emit GrantAdded(_recipient);
        token.crowdsaleApprove(_recipient, _amount);
        // Transfer the grant tokens under the control of the vesting contract
        token.transferFrom(_recipient, address(this), _amount);
    }

    /// @notice Allows a grant recipient to claim their vested tokens. Errors if no tokens have vested
    function claimVestedTokens() external {
        uint256 monthsVested;
        uint256 amountVested;
        (monthsVested, amountVested) = calculateGrantClaim(msg.sender);
        require(amountVested > 0, "Vested is 0");

        Grant storage tokenGrant = tokenGrants[msg.sender];
        tokenGrant.monthsClaimed = uint256(tokenGrant.monthsClaimed.add(monthsVested));
        tokenGrant.totalClaimed = uint256(tokenGrant.totalClaimed.add(amountVested));
        
        emit GrantTokensClaimed(tokenGrant.recipient, amountVested);
        token.transfer(tokenGrant.recipient, amountVested);
    }

    /// @notice Terminate token grant transferring all vested tokens to the `_recipient`
    /// and returning all non-vested tokens to the contract owner
    /// Secured to the contract owner only
    /// @param _recipient address of the token grant recipient
    function revokeTokenGrant(address _recipient) 
        external 
    {
        Grant storage tokenGrant = tokenGrants[_recipient];
        uint256 monthsVested;
        uint256 amountVested;
        (monthsVested, amountVested) = calculateGrantClaim(_recipient);

        uint256 amountNotVested = (tokenGrant.amount.sub(tokenGrant.totalClaimed)).sub(amountVested);

        delete tokenGrants[_recipient];

        emit GrantRevoked(_recipient, amountVested, amountNotVested);

        // only transfer tokens if amounts are non-zero.
        // Negative cases are covered by upperbound check in addTokenGrant and overflow protection using SafeMath
        if (amountNotVested > 0) {
          token.transfer(crowdsale_address, amountNotVested);
        }
        if (amountVested > 0) {
          token.transfer(_recipient, amountVested);
        }
    }

    function getGrantStartTime(address _recipient) external view returns(uint256) {
        Grant storage tokenGrant = tokenGrants[_recipient];
        return tokenGrant.startTime;
    }

    function getGrantAmount(address _recipient) external view returns(uint256) {
        Grant storage tokenGrant = tokenGrants[_recipient];
        return tokenGrant.amount;
    }

    /// @notice Calculate the vested and unclaimed months and tokens available for `_grantId` to claim
    /// Due to rounding errors once grant duration is reached, returns the entire left grant amount
    /// Returns (0, 0) if lock duration has not been reached
    function calculateGrantClaim(address _recipient) public view returns (uint256, uint256) {
        Grant storage tokenGrant = tokenGrants[_recipient];

        require(tokenGrant.totalClaimed < tokenGrant.amount, "Grant fully claimed");

        // Check if lock duration was reached by comparing the current time with the startTime. If lock duration hasn't been reached, return 0, 0
        if (currentTime() < tokenGrant.startTime) {
            return (0, 0);
        }

        // Elapsed months is the number of months since the startTime (after lock duration is complete)
        // We add 1 to the calculation as any time after the unlock timestamp counts as the first elapsed month.
        // For example: lock duration of 0 and current time at day 1, counts as elapsed month of 1
        // Lock duration of 1 month and current time at day 31, counts as elapsed month of 2
        // This is to accomplish the design that the first batch of vested tokens are claimable immediately after unlock.
        uint256 elapsedMonths = currentTime().sub(tokenGrant.startTime).div(30 days).add(1); 
     
        // If over vesting duration, all tokens vested
        if (elapsedMonths >= tokenGrant.vestingDuration) {
            uint256 remainingGrant = tokenGrant.amount.sub(tokenGrant.totalClaimed);
            return (tokenGrant.vestingDuration, remainingGrant);
        } else {
            uint256 monthsVested = uint256(elapsedMonths.sub(tokenGrant.monthsClaimed));
            uint256 amountVestedPerMonth = tokenGrant.amount.div(uint256(tokenGrant.vestingDuration));
            uint256 amountVested = uint256(monthsVested.mul(amountVestedPerMonth));
            return (monthsVested, amountVested);
        }
    }

    function currentTime() private view returns(uint256) {
        return block.timestamp;
    }
}