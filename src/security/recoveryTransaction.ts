import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import type { RecoveryAction, RecoveryPlan } from "../api/types";

export const REKEY_PROGRAM_ID = "284Xsc92KLKwKb7gBYAB8CXWc979FHL11tc185UYqcbP";

const INSTRUCTION_NAMES: Record<RecoveryAction, string> = {
  initiate: "initiate_recovery",
  approve: "approve_recovery",
  cancel: "cancel_recovery",
  execute: "execute_recovery",
  expire: "expire_recovery",
};

function accountKey(plan: RecoveryPlan, name: string): PublicKey {
  const value = plan.accounts[name];
  if (typeof value !== "string") throw new Error(`The recovery plan is missing the ${name} account.`);
  try {
    return new PublicKey(value);
  } catch {
    throw new Error(`The recovery plan contains an invalid ${name} address.`);
  }
}

function sameAddress(left: PublicKey, right: PublicKey): boolean {
  return left.equals(right);
}

function verifyRecoveryAddresses(plan: RecoveryPlan, initialOwner: string, programId: PublicKey, walletConfig: PublicKey, recoveryRequest: PublicKey): void {
  let initialOwnerKey: PublicKey;
  try {
    initialOwnerKey = new PublicKey(initialOwner);
  } catch {
    throw new Error("The selected wallet initial-owner address is invalid.");
  }

  const [expectedWalletConfig] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("wallet"), initialOwnerKey.toBytes()],
    programId,
  );
  if (!walletConfig.equals(expectedWalletConfig)) {
    throw new Error("The API plan wallet account does not match the selected initial owner.");
  }

  const nonce = plan.args.nonce;
  if (typeof nonce !== "number" || !Number.isSafeInteger(nonce) || nonce < 0) {
    throw new Error("The API plan is missing a valid recovery nonce.");
  }
  const nonceBytes = new Uint8Array(8);
  new DataView(nonceBytes.buffer).setBigUint64(0, BigInt(nonce), true);
  const [expectedRecoveryRequest] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode("recovery"), walletConfig.toBytes(), nonceBytes],
    programId,
  );
  if (!recoveryRequest.equals(expectedRecoveryRequest)) {
    throw new Error("The API plan recovery account does not match the selected wallet and nonce.");
  }
}

export async function buildRecoveryInstruction(
  plan: RecoveryPlan,
  signer: PublicKey,
  initialOwner: string,
): Promise<TransactionInstruction> {
  if (plan.mode !== "live") throw new Error("Simulated plans cannot be submitted to Solana.");
  if (plan.programId !== REKEY_PROGRAM_ID) throw new Error("The plan targets an unexpected program; signing is blocked.");
  if (plan.requiresSignatureFrom !== signer.toBase58()) {
    throw new Error("The required signer does not match the connected wallet.");
  }

  let keys: TransactionInstruction["keys"];
  let argumentBytes = new Uint8Array();
  const programId = new PublicKey(plan.programId);
  const walletConfig = accountKey(plan, "walletConfig");
  const recoveryRequest = accountKey(plan, "recoveryRequest");
  verifyRecoveryAddresses(plan, initialOwner, programId, walletConfig, recoveryRequest);

  switch (plan.action) {
    case "initiate": {
      const initiator = plan.accounts.initiator ? accountKey(plan, "initiator") : new PublicKey(plan.requiresSignatureFrom);
      const systemProgram = plan.accounts.systemProgram ? accountKey(plan, "systemProgram") : SystemProgram.programId;
      if (!sameAddress(initiator, signer)) throw new Error("The plan initiator does not match the connected wallet.");
      if (!sameAddress(systemProgram, SystemProgram.programId)) throw new Error("The plan contains an unexpected system program.");
      const newOwner = plan.args.newOwner;
      if (typeof newOwner !== "string") throw new Error("The initiation plan is missing its new owner.");
      let ownerKey: PublicKey;
      try {
        ownerKey = new PublicKey(newOwner);
      } catch {
        throw new Error("The plan contains an invalid new owner address.");
      }
      argumentBytes = ownerKey.toBytes();
      keys = [
        { pubkey: walletConfig, isSigner: false, isWritable: true },
        { pubkey: recoveryRequest, isSigner: false, isWritable: true },
        { pubkey: initiator, isSigner: true, isWritable: true },
        { pubkey: systemProgram, isSigner: false, isWritable: false },
      ];
      break;
    }
    case "approve": {
      const guardian = plan.accounts.guardian ? accountKey(plan, "guardian") : new PublicKey(plan.requiresSignatureFrom);
      if (!sameAddress(guardian, signer)) throw new Error("The plan guardian does not match the connected wallet.");
      keys = [
        { pubkey: walletConfig, isSigner: false, isWritable: false },
        { pubkey: recoveryRequest, isSigner: false, isWritable: true },
        { pubkey: guardian, isSigner: true, isWritable: false },
      ];
      break;
    }
    case "cancel": {
      const owner = plan.accounts.owner ? accountKey(plan, "owner") : new PublicKey(plan.requiresSignatureFrom);
      if (!sameAddress(owner, signer)) throw new Error("The plan owner does not match the connected wallet.");
      keys = [
        { pubkey: walletConfig, isSigner: false, isWritable: false },
        { pubkey: recoveryRequest, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: false },
      ];
      break;
    }
    case "execute":
      keys = [
        { pubkey: walletConfig, isSigner: false, isWritable: true },
        { pubkey: recoveryRequest, isSigner: false, isWritable: true },
      ];
      break;
    case "expire":
      keys = [
        { pubkey: walletConfig, isSigner: false, isWritable: false },
        { pubkey: recoveryRequest, isSigner: false, isWritable: true },
      ];
      break;
    default:
      throw new Error("The recovery action is not supported by this client.");
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`global:${INSTRUCTION_NAMES[plan.action]}`),
  );
  const discriminator = new Uint8Array(digest).slice(0, 8);
  const data = new Uint8Array(discriminator.length + argumentBytes.length);
  data.set(discriminator);
  data.set(argumentBytes, discriminator.length);

  return new TransactionInstruction({
    programId,
    keys,
    data: data as TransactionInstruction["data"],
  });
}