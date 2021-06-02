const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const cTokenAbi = require('../abi/ctoken');
const erc20Abi = require('../abi/erc20');
const comptrollerAbi = require('../abi/comptroller');

describe('crToken', () => {
  const toWei = ethers.utils.parseEther;
  const provider = waffle.provider;
  const MAX = ethers.constants.MaxUint256;

  let externalAccount;
  let underlyingToken;
  let comptroller;

  // externalAddress has some underlying.
  const externalAddress = '0xE93381fB4c4F14bDa253907b18faD305D799241a';
  const crTokenAddress = '0xe89a6D0509faF730BD707bf868d9A2A744a363C7';
  const underlyingAddress = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984';
  const comptrollerAddress = '0x3d5BC3c8d13dcB8bF317092d84783c2697AE9258';
  const creamMultisigAddress = '0x6D5a7597896A703Fe8c85775B23395a48f971305';

  beforeEach(async () => {
    const faucet = (await ethers.getSigners())[0];
    externalAccount = await ethers.provider.getSigner(externalAddress);
    underlyingToken = new ethers.Contract(underlyingAddress, erc20Abi, provider);
    comptroller = new ethers.Contract(comptrollerAddress, comptrollerAbi, provider);

    // Give the external address some gas fees
    await faucet.sendTransaction({
      to: externalAddress,
      value: toWei('1')
    });
  });

  it('gas on CREAM', async() => {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [externalAddress]
    });

    await underlyingToken.connect(externalAccount).approve(crTokenAddress, MAX);
    // console.log('approved');

    // console.log('underlying:', ethers.utils.formatEther(await underlyingToken.balanceOf(externalAddress)));
    let crToken = new ethers.Contract(crTokenAddress, cTokenAbi, provider);
    let tx = await crToken.connect(externalAccount).mint(toWei('100'));
    let receipt = await tx.wait();
    console.log('mint gas cost:', receipt.gasUsed.toString());

    await comptroller.connect(externalAccount).enterMarkets([crTokenAddress]);

    // crToken = crToken.attach('0x797AAB1ce7c01eB727ab980762bA88e7133d2157');
    crToken = crToken.attach('0xD06527D5e56A3495252A528C4987003b712860eE');
    tx = await crToken.connect(externalAccount).borrow('100000000');
    receipt = await tx.wait();
    console.log('borrow gas cost:', receipt.gasUsed.toString());

    // console.log('supply balance:', ethers.utils.formatEther(await crToken.callStatic.balanceOfUnderlying(externalAddress)));

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamMultisigAddress]
    });
  });

  it('gas on Compound', async() => {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [externalAddress]
    });

    const cUNI = '0x35A18000230DA775CAc24873d00Ff85BccdeD550';
    await underlyingToken.connect(externalAccount).approve(cUNI, MAX);
    let cToken = new ethers.Contract(cUNI, cTokenAbi, provider);
    let tx = await cToken.connect(externalAccount).mint(toWei('100'));
    let receipt = await tx.wait();
    console.log('mint gas cost:', receipt.gasUsed.toString());

    comptroller = comptroller.attach('0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B');
    await comptroller.connect(externalAccount).enterMarkets([cUNI]);

    // cToken = cToken.attach('0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9');
    cToken = cToken.attach('0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5');
    tx = await cToken.connect(externalAccount).borrow('100000000');
    receipt = await tx.wait();
    // console.log(receipt.events[3].args.borrowAmount.toString());
    console.log('borrow gas cost:', receipt.gasUsed.toString());

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamMultisigAddress]
    });
  });
});
