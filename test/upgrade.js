const { ethers, waffle } = require("hardhat");
const cTokenAbi = require('../abi/ctoken');
const erc20Abi = require('../abi/erc20');

describe('crToken', () => {
  const toWei = ethers.utils.parseEther;
  const provider = waffle.provider;
  const MAX = ethers.constants.MaxUint256;

  let yvCurveSETHHolderAccount;
  let usdtHolderAccount;
  let creamAdminAccount;
  let yvCurveSETH;
  let usdt;

  // external address has some underlying.
  const yvCurveSETHHolderAddress = '0x5b33D097820A0197cdF939E050cF57ECbA11279A';
  const crYvCurveSETHAddress = '0x1bcaFA2C1b3a522E41bAa60C2E318981Ea8D1eb5';
  const usdtHolderAddress = '0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503';
  const crUSDTAddress = '0x797AAB1ce7c01eB727ab980762bA88e7133d2157';
  const yvCurveSETHAddress = '0xdCD90C7f6324cfa40d7169ef80b12031770B4325';
  const usdtAddress = '0xdac17f958d2ee523a2206206994597c13d831ec7';
  const creamMultisigAddress = '0x6D5a7597896A703Fe8c85775B23395a48f971305';

  before(async () => {
    const faucet = (await ethers.getSigners())[0];
    yvCurveSETHHolderAccount = await ethers.provider.getSigner(yvCurveSETHHolderAddress);
    usdtHolderAccount = await ethers.provider.getSigner(usdtHolderAddress);
    creamAdminAccount = await ethers.provider.getSigner(creamMultisigAddress);
    yvCurveSETH = new ethers.Contract(yvCurveSETHAddress, erc20Abi, provider);
    usdt = new ethers.Contract(usdtAddress, erc20Abi, provider);

    // Give the external address some gas fees
    await faucet.sendTransaction({
      to: yvCurveSETHHolderAddress,
      value: toWei('1')
    });
    await faucet.sendTransaction({
      to: usdtHolderAddress,
      value: toWei('1')
    });

    const delegateeFactory = await ethers.getContractFactory('CCapableErc20Delegate');
    const cDelegatee = await delegateeFactory.deploy();

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [creamMultisigAddress]
    });

    const crYvCurveSETH = new ethers.Contract(crYvCurveSETHAddress, cTokenAbi, provider);
    await crYvCurveSETH.connect(creamAdminAccount)._setImplementation(cDelegatee.address, true, '0x00');

    const crUSDT = new ethers.Contract(crUSDTAddress, cTokenAbi, provider);
    await crUSDT.connect(creamAdminAccount)._setImplementation(cDelegatee.address, true, '0x00');

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamMultisigAddress]
    });
  });

  it('mint yvCurve-sETH', async() => {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [yvCurveSETHHolderAddress]
    });

    await yvCurveSETH.connect(yvCurveSETHHolderAccount).approve(crYvCurveSETHAddress, MAX);
    console.log('approved');

    let crYvCurveSETH = new ethers.Contract(crYvCurveSETHAddress, cTokenAbi, provider);
    await crYvCurveSETH.connect(yvCurveSETHHolderAccount).mint(toWei('10'));
    console.log('minted', (await crYvCurveSETH.balanceOf(yvCurveSETHHolderAddress)).toString());

    await crYvCurveSETH.connect(yvCurveSETHHolderAccount).redeemUnderlying(toWei('10'));
    console.log('minted', (await crYvCurveSETH.balanceOf(yvCurveSETHHolderAddress)).toString());

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [yvCurveSETHHolderAddress]
    });
  });

  it('mint USDT', async() => {
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [usdtHolderAddress]
    });

    await usdt.connect(usdtHolderAccount).approve(crUSDTAddress, MAX);
    console.log('approved');

    let crUSDT = new ethers.Contract(crUSDTAddress, cTokenAbi, provider);
    await crUSDT.connect(usdtHolderAccount).mint('10000000');
    console.log('minted', (await crUSDT.balanceOf(usdtHolderAddress)).toString());

    await crUSDT.connect(usdtHolderAccount).redeemUnderlying('10000000');
    console.log('minted', (await crUSDT.balanceOf(usdtHolderAddress)).toString());

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [usdtHolderAddress]
    });
  });
});
