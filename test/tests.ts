import { ethers } from "hardhat";
import { expect } from "chai";
import type { Airdrop } from "../typechain-types";

describe("Airdrop", function () {
  let airdrop: Airdrop;
  let owner: any;
  let user1: any;
  let user2: any;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const AirdropFactory = await ethers.getContractFactory("Airdrop");
    airdrop = (await AirdropFactory.deploy()) as Airdrop;
    await airdrop.waitForDeployment();
  });

  it("allows eligible user to register", async function () {
    // Ensure user has at least 1 ETH
    const bal = await ethers.provider.getBalance(user1.address);
    if (bal < ethers.parseEther("1")) {
      await owner.sendTransaction({
        to: user1.address,
        value: ethers.parseEther("1"),
      });
    }

    await expect(airdrop.connect(user1).registerAddress()).to.not.be.reverted;
    expect(await airdrop.isEligible(user1.address)).to.be.true;
  });

  it("prevents duplicate registration", async function () {
    await owner.sendTransaction({ to: user1.address, value: ethers.parseEther("1") });
    await airdrop.connect(user1).registerAddress();

    await expect(airdrop.connect(user1).registerAddress())
      .to.be.revertedWith("Already registered");
  });

  it("includes registered addresses in viewAddresses", async function () {
    await owner.sendTransaction({ to: user1.address, value: ethers.parseEther("1") });
    await airdrop.connect(user1).registerAddress();
    await owner.sendTransaction({ to: user2.address, value: ethers.parseEther("1") });
    await airdrop.connect(user2).registerAddress();

    const addrs = await airdrop.viewAddresses();
    expect(addrs).to.include.members([user1.address, user2.address]);
  });

  it("returns correct allocation after owner adds funds", async function () {
    // Register two users
    await owner.sendTransaction({ to: user1.address, value: ethers.parseEther("1") });
    await airdrop.connect(user1).registerAddress();
    await owner.sendTransaction({ to: user2.address, value: ethers.parseEther("1") });
    await airdrop.connect(user2).registerAddress();

    // Owner deposits 2 ETH into the contract via addFunds
    await expect(
      airdrop.connect(owner).addFunds({ value: ethers.parseEther("2") })
    ).to.not.be.reverted;

    const alloc = await airdrop.viewAllocation();
    expect(alloc).to.equal(ethers.parseEther("1"));
  });

  it("only owner can add funds", async function () {
    await owner.sendTransaction({ to: user1.address, value: ethers.parseEther("1") });
    await airdrop.connect(user1).registerAddress();

    await expect(
      airdrop.connect(user1).addFunds({ value: ethers.parseEther("1") })
    ).to.be.revertedWith("Owner-only function");
  });

  it("startAirdrop distributes funds correctly", async function () {
    // Register and add funds
    await owner.sendTransaction({ to: user1.address, value: ethers.parseEther("1") });
    await owner.sendTransaction({ to: user2.address, value: ethers.parseEther("1") });
    await airdrop.connect(user1).registerAddress();
    await airdrop.connect(user2).registerAddress();

    // Owner deposits 3 ETH
    await airdrop.connect(owner).addFunds({ value: ethers.parseEther("3") });

    const before1 = await ethers.provider.getBalance(user1.address);
    const before2 = await ethers.provider.getBalance(user2.address);

    await expect(airdrop.connect(owner).startAirdrop()).to.not.be.reverted;

    const after1 = await ethers.provider.getBalance(user1.address);
    const after2 = await ethers.provider.getBalance(user2.address);

    // First user gets 3 / 2 = 1.5 ETH
    expect(after1 - before1).to.equal(ethers.parseEther("1.5"));
    expect(after2 - before2).to.equal(ethers.parseEther("1.5"));
  });

  it("allows owner to change ownership", async function () {
    await expect(airdrop.connect(owner).changeOwner(user1.address)).to.not.be.reverted;
    expect(await airdrop.owner()).to.equal(user1.address);
  });

  it("prevents non-owner from calling owner-only functions", async function () {
    await expect(
      airdrop.connect(user1).changeOwner(user2.address)
    ).to.be.revertedWith("Owner-only function");
    await expect(
      airdrop.connect(user1).startAirdrop()
    ).to.be.revertedWith("Owner-only function");
  });
});