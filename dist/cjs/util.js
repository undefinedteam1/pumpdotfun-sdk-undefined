"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTxDetails = exports.buildVersionedTx = exports.calculateWithSlippageSell = exports.calculateWithSlippageBuy = exports.DEFAULT_FINALITY = exports.DEFAULT_COMMITMENT = void 0;
exports.sendTx = sendTx;
const web3_js_1 = require("@solana/web3.js");
exports.DEFAULT_COMMITMENT = "finalized";
exports.DEFAULT_FINALITY = "finalized";
const calculateWithSlippageBuy = (amount, basisPoints) => {
    return amount + (amount * basisPoints) / 10000n;
};
exports.calculateWithSlippageBuy = calculateWithSlippageBuy;
const calculateWithSlippageSell = (amount, basisPoints) => {
    return amount - (amount * basisPoints) / 10000n;
};
exports.calculateWithSlippageSell = calculateWithSlippageSell;
async function sendTx(connection, tx, payer, signers, priorityFees, commitment = exports.DEFAULT_COMMITMENT, finality = exports.DEFAULT_FINALITY) {
    let newTx = new web3_js_1.Transaction();
    if (priorityFees) {
        const modifyComputeUnits = web3_js_1.ComputeBudgetProgram.setComputeUnitLimit({
            units: priorityFees.unitLimit,
        });
        const addPriorityFee = web3_js_1.ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: priorityFees.unitPrice,
        });
        newTx.add(modifyComputeUnits);
        newTx.add(addPriorityFee);
    }
    newTx.add(tx);
    let versionedTx = await (0, exports.buildVersionedTx)(connection, payer, newTx, commitment);
    versionedTx.sign(signers);
    try {
        const sig = await connection.sendTransaction(versionedTx, {
            skipPreflight: true,
        });
        console.log("sig:", `https://solscan.io/tx/${sig}`);
        let txResult = await (0, exports.getTxDetails)(connection, sig, commitment);
        if (!txResult) {
            return {
                success: false,
                error: "Transaction failed",
            };
        }
        return {
            success: true,
            signature: sig,
            results: txResult,
        };
    }
    catch (e) {
        if (e instanceof web3_js_1.SendTransactionError) {
            let ste = e;
            console.log(await ste.getLogs(connection));
        }
        else {
            console.error(e);
        }
        return {
            error: e,
            success: false,
        };
    }
}
const buildVersionedTx = async (connection, payer, tx, commitment = exports.DEFAULT_COMMITMENT) => {
    const blockHash = (await connection.getLatestBlockhash(commitment))
        .blockhash;
    let messageV0 = new web3_js_1.TransactionMessage({
        payerKey: payer,
        recentBlockhash: blockHash,
        instructions: tx.instructions,
    }).compileToV0Message();
    return new web3_js_1.VersionedTransaction(messageV0);
};
exports.buildVersionedTx = buildVersionedTx;
const getTxDetails = async (connection, signature, commitment = exports.DEFAULT_COMMITMENT) => {
    const blockhash = await connection.getLatestBlockhash();
    const blockhashWithExpiryBlockHeight = {
        blockhash: blockhash.blockhash,
        lastValidBlockHeight: blockhash.lastValidBlockHeight,
    };
    const lastValidBlockHeight = blockhashWithExpiryBlockHeight.lastValidBlockHeight - 30;
    // Loop for confirmation check
    let retryCount = 0;
    while (retryCount <= 30) {
        try {
            const status = await connection.getSignatureStatus(signature);
            if (status.value && status.value.confirmationStatus && status.value.confirmationStatus == commitment) {
                return signature;
            }
            if (status.value && status.value.err) {
                throw `Transaction failed: ${status.value.err} ${signature}`;
            }
            const blockHeight = await connection.getBlockHeight();
            if (blockHeight > lastValidBlockHeight) {
                throw `Transaction expired: ${signature}`;
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
            retryCount++;
        }
        catch (error) {
            console.log(error);
        }
    }
};
exports.getTxDetails = getTxDetails;
//# sourceMappingURL=util.js.map