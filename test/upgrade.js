const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const cTokenAbi = require('../abi/ctoken');
const wethAbi = require('../abi/weth');

describe('upgrade', () => {
  const provider = waffle.provider;
  const toWei = ethers.utils.parseEther;

  let accounts;
  let admin, adminAddress;

  let wbnb;
  let crWBNB;

  const wbnbAddress = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
  const creamMultisigAddress = '0x874F5B01f1107ef3E7Fd4FACe9293C655C19AEc7';
  const crWBNBAddress = '0x15CC701370cb8ADA2a2B6f4226eC5CF6AA93bC67';

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    admin = accounts[0];
    adminAddress = await admin.getAddress();

    // Cream Multisig is a Gnosis contract. Give it some BNBs.
    await admin.sendTransaction({
      to: creamMultisigAddress,
      value: toWei('1')
    });

    const creamMultisig = await ethers.provider.getSigner(creamMultisigAddress);

    const delegateeFactory = await ethers.getContractFactory('CWrappedNativeDelegate');
    const cDelegatee = await delegateeFactory.deploy();

    crWBNB = new ethers.Contract(crWBNBAddress, cTokenAbi, provider);
    wbnb = new ethers.Contract(wbnbAddress, wethAbi, provider);

    const bnbBalance1 = await provider.getBalance(crWBNB.address);
    const wbnbBalance1 = await wbnb.balanceOf(crWBNB.address);
    const cash1 = await crWBNB.getCash();
    expect(bnbBalance1).to.eq(0);
    expect(wbnbBalance1).to.gt(0);
    expect(cash1).to.eq(wbnbBalance1);

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [creamMultisigAddress]
    });
    await crWBNB.connect(creamMultisig)._setImplementation(cDelegatee.address, true, '0x00');
    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamMultisigAddress]
    });

    const bnbBalance2 = await provider.getBalance(crWBNB.address);
    const wbnbBalance2 = await wbnb.balanceOf(crWBNB.address);
    const cash2 = await crWBNB.getCash();
    expect(bnbBalance2).to.eq(wbnbBalance1);
    expect(wbnbBalance2).to.eq(0);
    expect(cash2).to.eq(cash1);
  });

  it('mint with wbnb', async () => {
    await wbnb.connect(admin).deposit({value: toWei('1')});
    await wbnb.connect(admin).approve(crWBNB.address, toWei('1'));
    await crWBNB.connect(admin).mint(toWei('1'));

    expect(await crWBNB.balanceOf(adminAddress)).to.equal(toWei('1'));
    expect(await provider.getBalance(crWBNB.address)).to.equal(toWei('1'));
  });

  it('mint with eth', async () => {
    await crWBNB.mintNative({value: toWei('1')});

    expect(await crWBNB.balanceOf(adminAddress)).to.equal(toWei('1'));
    expect(await provider.getBalance(crWBNB.address)).to.equal(toWei('1'));
  });

  it('mint with fallback', async () => {
    await expect(admin.sendTransaction({
      to: crWBNB.address,
      value: toWei('1')
    })).to.be.revertedWith('only wrapped native contract could send native token');
  });
});
