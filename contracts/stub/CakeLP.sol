pragma solidity ^0.5.16;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";

contract CakeLP is ERC20, ERC20Detailed("CakeLP Token", "SLP", 18) {
    constructor() public {
        _mint(msg.sender, 10000e18);
    }
}
