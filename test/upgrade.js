const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");
const ctokenAbi = require('../abi/ctoken');
const comptrollerAbi = require('../abi/comptroller');
const unitrollerAbi = require('../abi/unitroller');

describe('upgrade', () => {
  const toWei = ethers.utils.parseEther;
  const provider = waffle.provider;

  let accounts;

  let cyWeth;
  let cyDai;
  let cyUsdc;
  let cyUsdt;
  let cyDpi;
  let cyLink;
  let cySnx;
  let cySusd;
  let cyWbtc;
  let cyYfi;
  let cyUni;
  let cySushi;

  let unitroller;
  let newComptroller;

  const unitrollerAddress = '0xAB1c342C7bf5Ec5F02ADEA1c2270670bCa144CbB';

  const creamMultisigAddress = '0x6D5a7597896A703Fe8c85775B23395a48f971305';
  const cyWethAddress = '0x41c84c0e2EE0b740Cf0d31F63f3B6F627DC6b393';
  const cyDaiAddress = '0x8e595470Ed749b85C6F7669de83EAe304C2ec68F';
  const cyUsdtAddress = '0x48759F220ED983dB51fA7A8C0D2AAb8f3ce4166a';
  const cyUsdcAddress = '0x76Eb2FE28b36B3ee97F3Adae0C69606eeDB2A37c';
  const cyDpiAddress = '0x7736Ffb07104c0C400Bb0CC9A7C228452A732992';
  const cyLinkAddress = '0xE7BFf2Da8A2f619c2586FB83938Fa56CE803aA16';
  const cySnxAddress = '0x12A9cC33A980DAa74E00cc2d1A0E74C57A93d12C';
  const cySusdAddress = '0xa7c4054AFD3DbBbF5bFe80f41862b89ea05c9806';
  const cyWbtcAddress = '0x8Fc8BFD80d6A9F17Fb98A373023d72531792B431';
  const cyYfiAddress = '0xFa3472f7319477c9bFEcdD66E4B948569E7621b9';
  const cyUniAddress = '0xFEEB92386A055E2eF7C2B598c872a4047a7dB59F';
  const cySushiAddress = '0x226F3738238932BA0dB2319a8117D9555446102f';

  const creditAccountAddress = '0xba5eBAf3fc1Fcca67147050Bf80462393814E54B'; // AHv2

  beforeEach(async () => {
    accounts = await ethers.getSigners();

    unitroller = new ethers.Contract(unitrollerAddress, unitrollerAbi, provider);

    cyWeth = new ethers.Contract(cyWethAddress, ctokenAbi, provider);
    cyDai = new ethers.Contract(cyDaiAddress, ctokenAbi, provider);
    cyUsdc = new ethers.Contract(cyUsdcAddress, ctokenAbi, provider);
    cyUsdt = new ethers.Contract(cyUsdtAddress, ctokenAbi, provider);
    cyDpi = new ethers.Contract(cyDpiAddress, ctokenAbi, provider);
    cyLink = new ethers.Contract(cyLinkAddress, ctokenAbi, provider);
    cySnx = new ethers.Contract(cySnxAddress, ctokenAbi, provider);
    cySusd = new ethers.Contract(cySusdAddress, ctokenAbi, provider);
    cyWbtc = new ethers.Contract(cyWbtcAddress, ctokenAbi, provider);
    cyYfi = new ethers.Contract(cyYfiAddress, ctokenAbi, provider);
    cyUni = new ethers.Contract(cyUniAddress, ctokenAbi, provider);
    cySushi = new ethers.Contract(cySushiAddress, ctokenAbi, provider);

    const wethBorrowBalance = await cyWeth.borrowBalanceStored(creditAccountAddress);
    const daiBorrowBalance = await cyDai.borrowBalanceStored(creditAccountAddress);
    const usdcBorrowBalance = await cyUsdc.borrowBalanceStored(creditAccountAddress);
    const usdtBorrowBalance = await cyUsdt.borrowBalanceStored(creditAccountAddress);
    const dpiBorrowBalance = await cyDpi.borrowBalanceStored(creditAccountAddress);
    const linkBorrowBalance = await cyLink.borrowBalanceStored(creditAccountAddress);
    const snxBorrowBalance = await cySnx.borrowBalanceStored(creditAccountAddress);
    const susdBorrowBalance = await cySusd.borrowBalanceStored(creditAccountAddress);
    const wbtcBorrowBalance = await cyWbtc.borrowBalanceStored(creditAccountAddress);
    const yfiBorrowBalance = await cyYfi.borrowBalanceStored(creditAccountAddress);
    const uniBorrowBalance = await cyUni.borrowBalanceStored(creditAccountAddress);
    const sushiBorrowBalance = await cySushi.borrowBalanceStored(creditAccountAddress);
    console.log('wethBorrowBalance', wethBorrowBalance.toString());
    console.log('daiBorrowBalance', daiBorrowBalance.toString());
    console.log('usdcBorrowBalance', usdcBorrowBalance.toString());
    console.log('usdtBorrowBalance', usdtBorrowBalance.toString());
    console.log('dpiBorrowBalance', dpiBorrowBalance.toString());
    console.log('linkBorrowBalance', linkBorrowBalance.toString());
    console.log('snxBorrowBalance', snxBorrowBalance.toString());
    console.log('susdBorrowBalance', susdBorrowBalance.toString());
    console.log('wbtcBorrowBalance', wbtcBorrowBalance.toString());
    console.log('yfiBorrowBalance', yfiBorrowBalance.toString());
    console.log('uniBorrowBalance', uniBorrowBalance.toString());
    console.log('sushiBorrowBalance', sushiBorrowBalance.toString());

    const comptrollerFactory = await ethers.getContractFactory('Comptroller');
    newComptroller = await comptrollerFactory.deploy();
  });

  it('upgrades comptroller', async () => {
    const creamMultisig = ethers.provider.getSigner(creamMultisigAddress);

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [creamMultisigAddress]
    });
    await unitroller.connect(creamMultisig)._setPendingImplementation(newComptroller.address);
    await newComptroller.connect(creamMultisig)._become(unitroller.address);
    unitroller = new ethers.Contract(unitrollerAddress, comptrollerAbi, provider);

    let liquidity = await unitroller.getAccountLiquidity(creditAccountAddress);
    expect(liquidity[0]).to.eq(0);
    expect(liquidity[1]).to.eq(0);
    expect(liquidity[2]).to.gt(0);

    await Promise.all([
      unitroller.connect(creamMultisig)._setCreditLimit(creditAccountAddress, cyWethAddress, toWei('12000')),
      unitroller.connect(creamMultisig)._setCreditLimit(creditAccountAddress, cyDaiAddress, toWei('20000000')),
      unitroller.connect(creamMultisig)._setCreditLimit(creditAccountAddress, cyUsdcAddress, '30000000' + '000000'),
      unitroller.connect(creamMultisig)._setCreditLimit(creditAccountAddress, cyUsdtAddress, '30000000' + '000000'),
      unitroller.connect(creamMultisig)._setCreditLimit(creditAccountAddress, cyDpiAddress, toWei('200')),
      unitroller.connect(creamMultisig)._setCreditLimit(creditAccountAddress, cyLinkAddress, toWei('10000')),
      unitroller.connect(creamMultisig)._setCreditLimit(creditAccountAddress, cySnxAddress, toWei('3000')),
      unitroller.connect(creamMultisig)._setCreditLimit(creditAccountAddress, cySusdAddress, toWei('300000')),
      unitroller.connect(creamMultisig)._setCreditLimit(creditAccountAddress, cyWbtcAddress, '50' + '00000000'),
      unitroller.connect(creamMultisig)._setCreditLimit(creditAccountAddress, cyYfiAddress, toWei('4')),
      unitroller.connect(creamMultisig)._setCreditLimit(creditAccountAddress, cyUniAddress, toWei('800')),
      unitroller.connect(creamMultisig)._setCreditLimit(creditAccountAddress, cySushiAddress, toWei('40000')),
    ]);

    liquidity = await unitroller.getAccountLiquidity(creditAccountAddress);
    expect(liquidity[0]).to.eq(0);
    expect(liquidity[1]).to.eq(0);
    expect(liquidity[2]).to.eq(0);

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [creamMultisigAddress]
    });
  });
});
