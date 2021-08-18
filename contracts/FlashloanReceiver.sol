pragma solidity ^0.5.16;

import "./ERC20.sol";
import "./CCollateralCapErc20.sol";
import "./ERC3156FlashLenderInterface.sol";
import "./CWrappedNative.sol";
import "./SafeMath.sol";
// FlashloanReceiver is a simple flashloan receiver implementation for testing
contract FlashloanReceiver is ERC3156FlashBorrowerInterface {
    using SafeMath for uint256;


    address borrowToken;

    function doFlashloan(
        address flashloanLender,
        address cToken,
        uint256 borrowAmount,
        uint256 repayAmount
    ) external {
        borrowToken = CCollateralCapErc20(cToken).underlying();
        uint256 balanceBefore = ERC20(borrowToken).balanceOf(address(this));
        bytes memory data = abi.encode(cToken, borrowAmount, repayAmount);
        ERC3156FlashLenderInterface(flashloanLender).flashLoan(this, borrowToken, borrowAmount, data);
    }

    function onFlashLoan(
        address initiator,
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external returns (bytes32) {
        require(initiator == address(this), "FlashBorrower: Untrusted loan initiator");
        ERC20(borrowToken).approve(msg.sender, amount.add(fee));
        (address cToken, uint256 borrowAmount, uint256 repayAmount) = abi.decode(data, (address, uint256, uint256));
        require(amount == borrowAmount, "Params not match");
        return keccak256("ERC3156FlashBorrowerInterface.onFlashLoan");
    }
}

