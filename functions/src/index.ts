import * as functions from 'firebase-functions';
import admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

import apiPagamentos from './apiPagamentos';
const porcentagem_more = 10; // MORE -> recebe 10% do valor total do pagamento
const porcentagem_destino = 90; // prestador do serviço -> recebe 90% do valor total do pagamento
//const mensagens_pagamentos = ['Compra de crédito', 'Assinatura']
const payment = new apiPagamentos(porcentagem_more, porcentagem_destino);
const auth = payment.oauthToken();


// DB - refs
const movimentacoesFinanceirasRef = (instituicao_id:string) => {
    return db.collection(`movimentacoes-financeiras`).doc(`${instituicao_id}`)
}

const confirmacaoPagamentoRef = (instituicao_id:string) => {
    return db.collection(`confirmacao-pagamento`).doc(`${instituicao_id}`)
}


// funções 
const consultaSaldoInstituicao = async (instituicao_id:any) => {
    const moFiRef   = movimentacoesFinanceirasRef(instituicao_id);
    const snapshot  = await moFiRef.get();
    const data      = snapshot.data();

    let saldoAtual      = 0;
    let saldoDisponivel = 0;
    if (data) {
        saldoAtual = data.saldoAtual;
        saldoDisponivel = data.saldoDisponivel;
    }
    return {saldoAtual, saldoDisponivel}
};

const atualizaSaldoAtualInstituicao = async (instituicao_id:any, valor: any) => {
    const moFiRef = movimentacoesFinanceirasRef(instituicao_id);
    const saldo   = consultaSaldoInstituicao(instituicao_id);
    const adiconar_credito = parseInt(valor)
    return await saldo.then(async (result) => {
        const saldoAtual = result.saldoAtual;
        const saldo_atualizado = (adiconar_credito + saldoAtual);
        await moFiRef.update({ saldoAtual: saldo_atualizado })
        .then(() => {
            return { saldoAtual, saldoDisponivel: result.saldoDisponivel }
        })
        .catch((err:any) => {
            return err
        });
    }).catch((err:any) => {
        return err
    });
};

const notificacaoPagamento = async (instituicao_id:any, data:any) => {
    const moFiRef = confirmacaoPagamentoRef(instituicao_id);
    return await moFiRef.set({ webhook: data })
    .then((ret) => {
        return ret
    })
    .catch((err:any) => {
        return err
    });
};

const atualizaSaldoDisponivelInstituicao = async (instituicao_id:any, valor: any) => {
    const moFiRef = movimentacoesFinanceirasRef(instituicao_id);
    const saldo   = consultaSaldoInstituicao(instituicao_id);
    const atualizar_saldo_disponivel = parseInt(valor);
    return await saldo.then(async (result) => {
        const saldoAtual = result.saldoAtual;
        const saldoDisponivel = result.saldoDisponivel;
        const novoSaldoAtual = (saldoAtual - atualizar_saldo_disponivel);
        const novoSaldoDisponivel = (saldoDisponivel + atualizar_saldo_disponivel);
        await moFiRef.update({ saldoAtual: novoSaldoAtual, saldoDisponivel: novoSaldoDisponivel })
        .then(() => {
            return { saldoAtual: novoSaldoAtual, saldoDisponivel: novoSaldoDisponivel }
        })
        .catch((err:any) => {
            return err
        });
    }).catch((err:any) => {
        return err
    });
};


// http functions
export const medicoAceitaServico = functions.https.onRequest(async (req, res) => {
    const instituicaoId = req.query.instituicaoId;
    const valorSaldoLiberado = req.query.valorSaldoLiberado;
    await atualizaSaldoDisponivelInstituicao(instituicaoId, valorSaldoLiberado)
    .then((result) => {
        res.status(200).json({
            success: true,
            data: result,
            message: "médico aceitou serviço"
        });
    })
    .catch((err:any) => { // erro atualizar saldo
        res.status(400).json({
            success: false,
            data: [],
            message: err
        })
    });
});

export const saldoInstituicao = functions.https.onRequest(async (req, res) => {
    const instituicaoId = req.query.instituicaoId;
    const saldo = consultaSaldoInstituicao(instituicaoId);
    saldo.then((result) => {
        res.status(200).json({
            success: true,
            data: result,
            message: "saldo da instituição"
        });
    }).catch((err) => {
        res.status(500).json({
            success: false,
            data: err,
            message: "erro"
        });
    });
});

export const cartoesCredito = functions.https.onRequest(async (req, res) => {
    const instituicaoId = req.query.instituicaoId;
    const moFiRef = db.collection(`movimentacoes-financeiras`).doc(`${instituicaoId}`).collection("cartoes-credito");
    const snapshot = await moFiRef.get();

    const cartoes:Array<[]> = [];
    snapshot.forEach((doc:any) => {
        cartoes.push(doc.data()); //console.log(doc.id, '=>', doc.data());
    });
    res.status(200).json({
        success: true,
        data: cartoes,
        message: "lista de cartões"
    });
});

export const criarWebhooks = functions.https.onRequest(async (req, res) => {
    await auth.then((datares:any) => {
        const Atoken = 
            datares.access_token,
            url_wehhook = "https://us-central1-teste-func-66903.cloudfunctions.net/notificacaoPagamentoWebHook",
            event_types = ['PAYMENT_NOTIFICATION'];
        const reqCriarWebhooks = payment.criarWebhooks(url_wehhook, event_types, Atoken);
        reqCriarWebhooks.then((resC:any) => {
            res.status(200).json({
                success: true,
                data: resC.data,
                message: "webhook criado com sucesso"
            });
        })
        .catch((erC:any) => { 
            res.status(400).json({
                success: false,
                data: [],
                message: erC.response.data
            })
        });
    });
});

export const deletaWebhooks = functions.https.onRequest(async (req, res) => {
    //webhookId = "wbh_7E08F21133936329";
    const id_webhook = req.query.webhookId;
    await auth.then((datares:any) => {
        const Atoken = datares.access_token;
        const reqDeletaWebhooks = payment.deletaWebhooks(id_webhook, Atoken);
        reqDeletaWebhooks.then((resC:any) => {
            res.status(200).json({
                success: true,
                data: resC.data,
                message: "webhook deletado"
            });
        })
        .catch((erC:any) => { 
            res.status(400).json({
                success: false,
                data: [],
                message: erC.response.data
            })
        });
    });
});

export const notificacaoPagamentoWebHook = functions.https.onRequest(async (req, res) => {
    //const instituicaoId = req.query.instituicaoId;
    const instituicaoId = "MeRbyJZPmRDSfsVrmnIM"
    await notificacaoPagamento(instituicaoId, res)
    .then(() => {
        res.status(200).json({
            success: true,
            data: [],
            message: "notificação de recebimento de pagamento"
        });
    })
    .catch((err:any) => {
        res.status(400).json({
            success: false,
            data: [],
            message: err
        })
    });
});


/*
usuário-cliente solicitou alteração no código
*/
export const inserirCreditosViaBoleto = functions.https.onRequest(async (req, res) => {
    const query_valor:any = req.query.valorCredito;
    //const data_vencimento:any = req.query.data_vencimento;
    //const nome_comprador:any = req.query.nome_comprador;
    //const documento_comprador:any = req.query.documento_comprador;
    const 
        valorCredito = parseInt(query_valor),
        dadosCobranca = {
            descricao: "inserir crédito via boleto",
            valor_cobranca: valorCredito,
            tipo_pagamento: ['BOLETO'],// ["CREDIT_CARD"], ["CREDIT_CARD", "BOLETO"] ou ["BOLETO"]
            data_vencimento: "2020-09-11", // "yyyy-MM-dd"
            nome_comprador: 'nome da pessoa ou empresa',
            documento_comprador: '91265426090'// CPF ou CNPJ
        };

    await auth.then((datares:any) => {

        const Atoken = datares.access_token;

            //const creditCardId = resT.data.creditCardId;
            const inserirCreditosBoleto = payment.inserirCreditosBoleto(dadosCobranca, Atoken);
            inserirCreditosBoleto.then((resC:any) => {


                    res.status(200).json({
                        success: true,
                        data: resC.data,
                        message: "boleto gerado com sucesso"
                    });

                    /*


                    await atualizaSaldoAtualInstituicao(instituicaoId, valorCredito)
                    .then(() => {
                        const reslt = {
                            chargeId,
                            payments_id: resP.data.payments[0].id,
                            saldo_atualizado: true
                        };
                        res.status(200).json({
                            success: true,
                            data: reslt,
                            message: "crédito inserido com sucesso"
                        });
                    })
                    .catch((err:any) => { // erro atualizar saldo
                        res.status(400).json({
                            success: false,
                            data: [],
                            message: err
                        })
                    });
                    */

            })
            .catch((erC:any) => { // 
                res.status(400).json({
                    success: false,
                    data: [],
                    message: erC.response.data
                })
            });
    })
    .catch((err:any) => { // erro de auth
        res.status(500).json({
            success: false,
            data: [],
            message: "Não foi possível autenticar"
        })
    })
});

export const inserirCreditosViaCartao = functions.https.onRequest(async (req, res) => {
    const query_valor:any = req.query.valorCredito;
    const 
        valorCredito = parseInt(query_valor),
        creditCardId = req.query.creditCardId,
        instituicaoId  = req.query.instituicaoId,
        dadosCobranca = {
            descricao: "inserir crédito vai cartão",
            valor_cobranca: valorCredito,
            tipo_pagamento: ['CREDIT_CARD'],// ["CREDIT_CARD"], ["CREDIT_CARD", "BOLETO"] ou ["BOLETO"]
            nome_comprador: 'nome da pessoa ou empresa',
            documento_comprador: '91265426090'// CPF ou CNPJ
        },
        endereco = {
            street: "rua monte castelo",
            number: "1",
            city: "Salvador",
            state: "BA",
            postCode: "40301210",
        },
        email = 'ronafreitasweb@gmail.com';

    await auth.then((datares:any) => {

        const Atoken = datares.access_token;

            const criarCobrancaDiretaMore = payment.criarCobrancaDiretaMore(dadosCobranca, Atoken);
            criarCobrancaDiretaMore.then((resC:any) => {

                const chargeId = resC.data._embedded.charges[0].id;
                const criarPagamentoDeCobrancaMore = payment.criarPagamentoDeCobrancaMore(chargeId, endereco, creditCardId, email, Atoken);
                criarPagamentoDeCobrancaMore.then(async (resP:any) => {
                    await atualizaSaldoAtualInstituicao(instituicaoId, valorCredito)
                    .then(() => {
                        const reslt = {
                            chargeId,
                            payments_id: resP.data.payments[0].id,
                            saldo_atualizado: true
                        };
                        res.status(200).json({
                            success: true,
                            data: reslt,
                            message: "crédito inserido com sucesso"
                        });
                    })
                    .catch((err:any) => { // erro atualizar saldo
                        res.status(400).json({
                            success: false,
                            data: [],
                            message: err
                        })
                    });
                })
                .catch((erP:any) => { // erro realizar pagamento de cobrança
                    res.status(400).json({
                        success: false,
                        data: [],
                        message: erP.response.data
                    })
                });
            })
            .catch((erC:any) => { // erro criar cobrança para inserir crédito
                res.status(400).json({
                    success: false,
                    data: [],
                    message: erC.response.data
                })
            });

    })
    .catch((err:any) => { // erro de auth
        res.status(500).json({
            success: false,
            data: [],
            message: "Não foi possível autenticar"
        })
    })
});

export const tokenizar = functions.https.onRequest(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const hashCreditCard = req.query.hashCreditCard;
    await auth.then(async (datares:any) => {
        const Atoken = datares.access_token;
        const tokenizarCartao = payment.tokenizarCartao(hashCreditCard, Atoken);
        await tokenizarCartao.then(async (resT:any) => {
            res.status(200).json({
                success: true,
                data: resT.data,
                message: "tokenizar Cartao"
            })
        })
        .catch((erT:any) => {
            res.status(400).json({
                success: false,
                data: [],
                message: erT.response.data
            })
        });
    })
    .catch((err:any) => {
        res.status(500).json({
            success: false,
            data: [],
            message: "Não foi possível autenticar"
        })
    })
});


/*



export const inserirCreditosViaCartao = functions.https.onRequest(async (req, res) => {
    const query_valor:any = req.query.valorCredito;
    const 
        valorCredito = parseInt(query_valor),
        hashCreditCard = req.query.hashCreditCard,
        instituicaoId  = req.query.instituicaoId,
        dadosCobranca = {
            descricao: "inserir crédito vai cartão",
            valor_cobranca: valorCredito,
            tipo_pagamento: ['CREDIT_CARD'],// ["CREDIT_CARD"], ["CREDIT_CARD", "BOLETO"] ou ["BOLETO"]
            nome_comprador: 'nome da pessoa ou empresa',
            documento_comprador: '91265426090'// CPF ou CNPJ
        },
        endereco = {
            street: "rua monte castelo",
            number: "1",
            city: "Salvador",
            state: "BA",
            postCode: "40301210",
        },
        email = 'ronafreitasweb@gmail.com';

    await auth.then((datares:any) => {

        const Atoken = datares.access_token;
        const tokenizarCartao = payment.tokenizarCartao(hashCreditCard, Atoken);
        tokenizarCartao.then((resT:any) => {

            const creditCardId = resT.data.creditCardId;
            const criarCobrancaDiretaMore = payment.criarCobrancaDiretaMore(dadosCobranca, Atoken);
            criarCobrancaDiretaMore.then((resC:any) => {

                const chargeId = resC.data._embedded.charges[0].id;
                const criarPagamentoDeCobrancaMore = payment.criarPagamentoDeCobrancaMore(chargeId, endereco, creditCardId, email, Atoken);
                criarPagamentoDeCobrancaMore.then(async (resP:any) => {
                    await atualizaSaldoAtualInstituicao(instituicaoId, valorCredito)
                    .then(() => {
                        const reslt = {
                            chargeId,
                            payments_id: resP.data.payments[0].id,
                            saldo_atualizado: true
                        };
                        res.status(200).json({
                            success: true,
                            data: reslt,
                            message: "crédito inserido com sucesso"
                        });
                    })
                    .catch((err:any) => { // erro atualizar saldo
                        res.status(400).json({
                            success: false,
                            data: [],
                            message: err
                        })
                    });
                })
                .catch((erP:any) => { // erro realizar pagamento de cobrança
                    res.status(400).json({
                        success: false,
                        data: [],
                        message: erP.response.data
                    })
                });
            })
            .catch((erC:any) => { // erro criar cobrança para inserir crédito
                res.status(400).json({
                    success: false,
                    data: [],
                    message: erC.response.data
                })
            });
        })
        .catch((erT:any) => { // erro tokenizar cartão
            res.status(400).json({
                success: false,
                data: [],
                message: erT.response.data
            })
        });
    })
    .catch((err:any) => { // erro de auth
        res.status(500).json({
            success: false,
            data: [],
            message: "Não foi possível autenticar"
        })
    })
});


export const saldo_juno = functions.https.onRequest(async (req, res) => {
    await auth.then((authdata:any) => {
        const Atoken = authdata.access_token;
        const saldo = payment.saldo(Atoken);
        saldo.then(async (datares:any) => {
            await db.collection("saldo").add({ detalhes: datares.data })
            .then(() => {
                res.status(200).json({
                    success: true,
                    data: datares.data,
                    message: "saldo em conta"
                })
            })
            .catch((err:any) => {
                res.status(500).json({
                    success: false,
                    data: [],
                    message: err
                })
            });
        })
        .catch((err:any) => {
            res.status(400).json({
                success: false,
                data: [],
                message: err.response.data
            })
        });
    })
    .catch((err:any) => {
        res.status(400).json({
            success: false,
            data: [],
            message: "Não foi possível autenticar"
        })
    })
});


// compra crédito
export const cobranca_juno = functions.https.onRequest(async (req, res) => {
    const 
        hashCreditCard  = req.query.hashCreditCard,
        dadosCobranca = {
            descricao: mensagens_pagamentos[0],
            valor_cobranca: 221.50,
            recipient_token_destino: '397F1B7B722DE52E88D68D8D3E16C5A45A376016E099F5093D79D83629DE8135',// destino do pagamento, prestador do serviço, quem vai receber o valor
            nome_comprador: 'ronaldo freitas da cunha',// nome da pessoa ou empresa
            documento_comprador: '91265426090',// CPF ou CNPJ
            tipo_pagamento: ['CREDIT_CARD']// ["CREDIT_CARD"], ["CREDIT_CARD", "BOLETO"] ou ["BOLETO"]
        },
        endereco = {
            street: "rua monte castelo",
            number: "1",
            city: "Salvador",
            state: "BA",
            postCode: "40301210",
        },
        email = 'ronafreitasweb@gmail.com';

    await auth.then(async (datares:any) => {
        const Atoken = datares.access_token;
        const tokenizarCartao = payment.tokenizarCartao(hashCreditCard, Atoken);
        await tokenizarCartao.then(async (resT:any) => {
            const creditCardId = resT.data.creditCardId;
            const criarCobrancaComSplit = payment.criarCobrancaComSplit(dadosCobranca, Atoken);
            await criarCobrancaComSplit.then(async (resC:any) => {
                const chargeId = resC.data._embedded.charges[0].id;
                const criarPagamentoDeCobranca = payment.criarPagamentoDeCobranca(chargeId, endereco, creditCardId, email, Atoken);
                await criarPagamentoDeCobranca.then((resP:any) => {
                    const reslt = {
                        chargeId,
                        payments_id: resP.data.payments[0].id
                    };
                    res.status(200).json({
                        success: true,
                        data: reslt,
                        message: "cobrança realizada"
                    })
                })
                .catch((erP:any) => {
                    res.status(400).json({
                        success: false,
                        data: [],
                        message: erP.response.data
                    })
                });
            })
            .catch((erC:any) => {
                res.status(400).json({
                    success: false,
                    data: [],
                    message: erC.response.data
                })
            });
        })
        .catch((erT:any) => {
            res.status(400).json({
                success: false,
                data: [],
                message: erT.response.data
            })
        });
    })
    .catch((err:any) => {
        res.status(500).json({
            success: false,
            data: [],
            message: "Não foi possível autenticar"
        })
    })
});

// 
export const capturar_juno = functions.https.onRequest(async (req, res) => {
    
    //const chargeId = 'chr_BB4525F9131AD8662A63BF699C06D449';
    //const payments_id = 'pay_13A171B639DFC734';
    
    const
        chargeId = req.query.chargeId,
        payments_id = req.query.payments_id;

    await auth.then(async (authdata:any) => {
        const Atoken = authdata.access_token;
        const capturar = payment.capturarPagamento(chargeId, payments_id, Atoken);
        capturar.then(async (datares:any) => {
            await db.collection("pagamentos").add({ detalhes: datares.data })
            .then(() => {
                res.status(200).json({
                    success: true,
                    data: datares.data,
                    message: "pagamento capturado"
                })
            })
            .catch((err:any) => {
                res.status(500).json({
                    success: false,
                    data: [],
                    message: err.response.data
                })
            });
        })
        .catch((err:any) => {
            res.status(400).json({
                success: false,
                data: [],
                message: err.response.data
            })
        })
    })
    .catch((err:any) => {
        res.status(500).json({
            success: false,
            data: [],
            message: "Não foi possível autenticar"
        })
    })
});
*/