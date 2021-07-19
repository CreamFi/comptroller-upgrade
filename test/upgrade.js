const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const cTokenAbi = require('../abi/ctoken');
const wethAbi = require('../abi/weth');

describe('upgrade', () => {
  const provider = waffle.provider;
  const toWei = ethers.utils.parseEther;

  let accounts;
  let admin, adminAddress;

  let wMATIC;
  let crWMATIC;

  const wMATICAddress = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
  const creamAdminAddress = '0x197939c1ca20C2b506d6811d8B6CDB3394471074';
  const crWMATICAddress = '0x3FaE5e5722C51cdb5B0afD8c7082e8a6AF336Ee8';

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    admin = accounts[0];
    adminAddress = await admin.getAddress();

    const creamAdmin = await ethers.provider.getSigner(creamAdminAddress);

    const delegateeFactory = await ethers.getContractFactory('CWrappedNativeDelegate');
    const cDelegatee = await delegateeFactory.deploy();

    crWMATIC = new ethers.Contract(crWMATICAddress, cTokenAbi, provider);
    wMATIC = new ethers.Contract(wMATICAddress, wethAbi, provider);

    const maticBalance1 = await provider.getBalance(crWMATIC.address);
    const wMATICBalance1 = await wMATIC.balanceOf(crWMATIC.address);
    const cash1 = await crWMATIC.getCash();
    expect(maticBalance1).to.gt(0);
    expect(wMATICBalance1).to.eq(0);
    expect(cash1).to.eq(maticBalance1);

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [creamAdminAddress]
    });
    await crWMATIC.connect(creamAdmin)._setImplementation(cDelegatee.address, true, '0x00');
    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamAdminAddress]
    });

    const maticBalance2 = await provider.getBalance(crWMATIC.address);
    const wMATICBalance2 = await wMATIC.balanceOf(crWMATIC.address);
    const cash2 = await crWMATIC.getCash();
    expect(maticBalance2).to.eq(0);
    expect(wMATICBalance2).to.eq(maticBalance1);
    expect(cash2).to.eq(cash1);
  });

  it('mint with wMATIC', async () => {
    await wMATIC.connect(admin).deposit({value: toWei('1')});
    await wMATIC.connect(admin).approve(crWMATIC.address, toWei('1'));
    await crWMATIC.connect(admin).mint(toWei('1'));
  });
});
