/**
 * To run the below tests use below commands
 * 
 * npm install mocha chai --save-dev
 * 
 * npm tests
 */

const chai = require('chai');
const chaiHttp = require('chai-http');
const app = require('../app'); 

const { expect } = chai;
chai.use(chaiHttp);

describe('charge function', () => {
    it('should charge an account and return the updated balance', (done) => {
        chai.request(app)
            .post('/charge')
            .send({ account: 'testAccount', charges: 20 }) // Adjust data as needed
            .end((err, res) => {
                expect(res).to.have.status(200);
                expect(res.body.isAuthorized).to.equal(true);
                expect(res.body.remainingBalance).to.equal(80); // Adjust expected balance
                done();
            });
    });

    it('should not authorize when balance is insufficient', (done) => {
        chai.request(app)
            .post('/charge')
            .send({ account: 'testAccount', charges: 120 }) // Adjust data as needed
            .end((err, res) => {
                expect(res).to.have.status(200);
                expect(res.body.isAuthorized).to.equal(false);
                expect(res.body.remainingBalance).to.equal(80); // Balance should remain unchanged
                done();
            });
    });

    it('should not authorize when charges are negative', (done) => {
        chai.request(app)
            .post('/charge')
            .send({ account: 'testAccount', charges: -10 }) // Negative charges
            .end((err, res) => {
                expect(res).to.have.status(200);
                expect(res.body.isAuthorized).to.equal(false);
                expect(res.body.remainingBalance).to.equal(100); // Balance should remain unchanged
                done();
            });
    });

    it('should reset the balance to the default', (done) => {
        chai.request(app)
            .post('/reset')
            .send({ account: 'testAccount' }) // Adjust data as needed
            .end((err, res) => {
                expect(res).to.have.status(204);
                // Check if the balance is now the default balance (e.g., 100)
                chai.request(app)
                    .post('/charge')
                    .send({ account: 'testAccount', charges: 10 }) // Attempt to charge
                    .end((err, res) => {
                        expect(res).to.have.status(200);
                        expect(res.body.isAuthorized).to.equal(true);
                        expect(res.body.remainingBalance).to.equal(90); // Balance should be reduced
                        done();
                    });
            });
    });

    it('should reset a custom account', (done) => {
        chai.request(app)
            .post('/reset')
            .send({ account: 'customAccount' }) // Reset a custom account
            .end((err, res) => {
                expect(res).to.have.status(204);
                // Verify if the custom account balance is now the default balance (e.g., 100)
                chai.request(app)
                    .post('/charge')
                    .send({ account: 'customAccount', charges: 10 }) // Attempt to charge
                    .end((err, res) => {
                        expect(res).to.have.status(200);
                        expect(res.body.isAuthorized).to.equal(true);
                        expect(res.body.remainingBalance).to.equal(90); // Balance should be reduced
                        done();
                    });
            });
    });
});
