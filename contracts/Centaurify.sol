// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./CENT_ERC20.sol";
import "./abstracts/Snapshot.sol";
import "./abstracts/Ownable.sol";

contract Centaurify is ERC20, ERC20Snapshot {
    uint256 public snapshotId;
    constructor() ERC20() {
    }

    function snapshot() external onlyOwner {
        snapshotId = _snapshot();
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        override(ERC20, ERC20Snapshot)
    {
        super._beforeTokenTransfer(from, to, amount);
    }
}
