import axios from 'axios';

export interface Address {
    street: string;
    number: string;
    city: string;
    state: string;
    postCode: string;
}

export interface Charge {
    descricao: string;
    valor_cobranca: number;
    recipient_token_destino: string;
    nome_comprador: string;
    documento_comprador: string;
    tipo_pagamento: Array<string>;
}

export default class apiPagamentos {

    url_base_pay:string;
    X_Api_Version:number;
    X_Resource_Token_More:string;
    Basic_Auth:string;
    porcentagem_more:number;
    porcentagem_destino:number;

    constructor(porcentagem_more:number, porcentagem_destino:number) {
        this.url_base_pay = 'https://sandbox.boletobancario.com';
        this.X_Resource_Token_More = '3A0EEA171E5168286DE02A7FB8E482FC2EE904AF78A072B177A77B6A347E11E7';
        this.Basic_Auth = 'WGR5b3k5T2wybjNRWGthbjo2YjZLbnV2XkpJT3dNaCxdP2Q6VkB1Vz9MNntibCxtXw==';
        this.X_Api_Version = 2;

        this.porcentagem_more = porcentagem_more; // MORE -> recebe 10% do valor total do pagamento
        this.porcentagem_destino = porcentagem_destino; // prestador do serviço -> recebe 90% do valor total do pagamento
    }

    async oauthToken() {
        const config = {
            headers: {
                'Authorization': `Basic ${this.Basic_Auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
        return await axios.post(`${this.url_base_pay}/authorization-server/oauth/token`, 'grant_type=client_credentials', config)
        .then((ret) => {
            return ret.data
        })
        .catch((error) => {
            //return error.response.data.details
            return error
        })
    }

    async criarCobrancaComSplit(dadosCobranca:Charge, Access_Token:string) {
        const recipientToken_more = this.X_Resource_Token_More;
        const postData = {
            charge: {
                description: dadosCobranca.descricao,
                amount: dadosCobranca.valor_cobranca,
                paymentTypes: dadosCobranca.tipo_pagamento,
                split: [
                    {
                        recipientToken: recipientToken_more,
                        percentage: this.porcentagem_more,
                        amountRemainder: false,
                        chargeFee: true // se for true, indica que este pagará taxa da Juno
                    },
                    {
                        recipientToken: dadosCobranca.recipient_token_destino,
                        percentage: this.porcentagem_destino,
                        amountRemainder: true,// se for true, indica que recebe o 'restante' do valor total
                        chargeFee: false
                    }
                ]
            },
            billing: {
                name: dadosCobranca.nome_comprador,
                document: dadosCobranca.documento_comprador
            }
        };
        const config = {
            headers: {
                'Authorization': `Bearer ${Access_Token}`,
                'X-Api-Version': this.X_Api_Version,
                'X-Resource-Token': this.X_Resource_Token_More,
                'Content-Type': `application/json;charset=UTF-8`,
            }
        }
        return await axios.post(`${this.url_base_pay}/api-integration/charges`, postData, config);
    }

    async tokenizarCartao(creditCardHash:any, Access_Token:string) {
        const postData = {
            "creditCardHash": creditCardHash
        }
        const config = {
            headers: {
                'Authorization': `Bearer ${Access_Token}`,
                'X-Api-Version': this.X_Api_Version,
                'X-Resource-Token': this.X_Resource_Token_More,
                'Content-Type': `application/json;charset=UTF-8`,
            }
        }
        return await axios.post(`${this.url_base_pay}/api-integration/credit-cards/tokenization`, postData, config);
    }

    async criarPagamentoDeCobranca(chargeId:string, address:Address, creditCardId:string, email:string, Access_Token:string) {
        const postData = {
            chargeId,
            billing:{
                email,
                address:address,
                delayed:true// se true, o valor do destino do prestador do serviço, fica retido até a captura do pagamento (capturarPagamento)
            },
            creditCardDetails: {creditCardId}
        };
        const config = {
            headers: {
                'Authorization': `Bearer ${Access_Token}`,
                'X-Api-Version': this.X_Api_Version,
                'X-Resource-Token': this.X_Resource_Token_More,
                'Content-Type': `application/json;charset=UTF-8`,
            }
        }
        return await axios.post(`${this.url_base_pay}/api-integration/payments`, postData, config);
    }

    async capturarPagamento(chargeId:any, paymentId:any, Access_Token:string) {
        const postData = {chargeId};
        const config = {
            headers: {
                'Authorization': `Bearer ${Access_Token}`,
                'X-Api-Version': this.X_Api_Version,
                'X-Resource-Token': this.X_Resource_Token_More,
                'Content-Type': `application/json;charset=UTF-8`,
            }
        }
        return await axios.post(`${this.url_base_pay}/api-integration/payments/${paymentId}/capture`, postData, config);
    }

    async saldo(Access_Token:string) {
        const config = {
            headers: {
                'Authorization': `Bearer ${Access_Token}`,
                'X-Api-Version': this.X_Api_Version,
                'X-Resource-Token': this.X_Resource_Token_More,
                'Content-Type': `application/json;charset=UTF-8`,
            }
        }
        return await axios.get(`${this.url_base_pay}/api-integration/balance`, config);
    }
}