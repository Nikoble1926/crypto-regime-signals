// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title RegimeOracle
/// @notice On-chain attestations of crypto market-regime signals on Pharos.
///         Companion to the "Crypto Regime Signals" x402 Skill: the publisher
///         commits the latest regime read (label, quick-score, and a hash of the
///         full signal payload) on-chain, giving the Skill a tamper-evident,
///         queryable track record that any agent or contract can verify.
contract RegimeOracle {
    address public immutable publisher;

    struct Attestation {
        string regime;     // "trending_up" | "trending_down" | "ranging" | "high_volatility"
        uint16 quickScore; // 0-100
        uint64 timestamp;  // block time of attestation
        bytes32 dataHash;  // keccak256 of the full signal JSON
    }

    mapping(string => Attestation) public latest; // pair => latest attestation
    uint256 public total;

    event RegimeAttested(
        string indexed pair,
        string regime,
        uint16 quickScore,
        bytes32 dataHash,
        uint64 timestamp
    );

    constructor() {
        publisher = msg.sender;
    }

    /// @notice Commit the latest regime signal for a pair. Publisher-only.
    function attest(
        string calldata pair,
        string calldata regime,
        uint16 quickScore,
        bytes32 dataHash
    ) external {
        require(msg.sender == publisher, "only publisher");
        require(quickScore <= 100, "score>100");
        latest[pair] = Attestation(regime, quickScore, uint64(block.timestamp), dataHash);
        unchecked { total += 1; }
        emit RegimeAttested(pair, regime, quickScore, dataHash, uint64(block.timestamp));
    }
}
