// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./Crowdsale.sol";

/**
 * @title TimedCrowdsale
 * @dev Crowdsale accepting contributions only within a time frame.
 */
abstract contract TimedCrowdsale is Crowdsale {
  using SafeMath for uint256;

  uint256 public openingTime;
  uint256 public closingTime;

  /**
    * Event for crowdsale extending
    * @param newClosingTime new closing time
    * @param prevClosingTime old closing time
    */
  event TimedCrowdsaleExtended(uint256 prevClosingTime, uint256 newClosingTime);

  /**
   * @dev Reverts if not in crowdsale time range.
   */
  modifier onlyWhileOpen {
    // solium-disable-next-line security/no-block-members
    require(block.timestamp >= openingTime && block.timestamp <= closingTime);
    _;
  }

  /**
   * @dev Constructor, takes crowdsale opening and closing times.
   * @param _openingTime Crowdsale opening time
   * @param _closingTime Crowdsale closing time
   */
  constructor(uint256 _openingTime, uint256 _closingTime) {
    // solium-disable-next-line security/no-block-members
    require(_openingTime >= block.timestamp, "TimedCrowdsale: opening time is before current time");
    require(_closingTime >= _openingTime, "TimedCrowdsale: opening time is not before closing time");

    openingTime = _openingTime;
    closingTime = _closingTime;
  }

  /**
   * @dev Checks whether the period in which the crowdsale is open has already elapsed.
   * @return Whether crowdsale period has elapsed
   */
  function hasClosed() public view returns (bool) {
    // solium-disable-next-line security/no-block-members
    return block.timestamp > closingTime;
  }

  /**
    * @dev Extend crowdsale.
    * @param newClosingTime Crowdsale closing time
    */
  function _extendTime(uint256 newClosingTime) internal {
    require(newClosingTime > closingTime, "TimedCrowdsale: new closing time is before current closing time");
    closingTime = newClosingTime;
    emit TimedCrowdsaleExtended(closingTime, newClosingTime);
  }
}