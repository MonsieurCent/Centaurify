// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BEP20.sol";
import "./abstracts/Snapshot.sol";
import "./abstracts/Ownable.sol";

contract Centaurify is BEP20, BEP20Snapshot {
    uint256 public snapshotId;
    constructor() BEP20() {
    }

    function snapshot() external onlyOwner {
        snapshotId = _snapshot();
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        override(BEP20, BEP20Snapshot)
    {
        super._beforeTokenTransfer(from, to, amount);
    }
}
