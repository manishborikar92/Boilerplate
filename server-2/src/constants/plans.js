const PLAN_CONFIG = {
    'plan_ca_flow_free': {
        name: 'Starter',
        maxClients: 5,
        monthlyRecords: 25,
        storage: 1, // GB
        notifications: ['email']
    },
    'plan_ca_flow_pro': {
        name: 'Pro',
        maxClients: 100, // Hard limit
        monthlyRecords: 500,
        storage: 50, // GB
        notifications: ['email', 'whatsapp', 'sms']
    }
};

const PRO_BILLING_OPTIONS = {
    monthly: {
        planName: 'Monthly',
        razorpayPlanName: 'CA Flow - Pro Monthly',
        description: 'Ideal for growing CA firms',
        amount: 34900,
        originalAmount: 49900,
        discount: 30,
        interval: 1,
        period: 'monthly',
        popular: true
    },
    quarterly: {
        planName: 'Quarterly',
        razorpayPlanName: 'CA Flow - Pro Quarterly',
        description: 'Save more with quarterly billing',
        amount: 79900,
        originalAmount: 119900,
        discount: 33,
        interval: 3,
        period: 'monthly',
        popular: false
    },
    halfYearly: {
        planName: 'Half-Yearly',
        razorpayPlanName: 'CA Flow - Pro Half-Yearly',
        description: 'Best value with half-yearly billing',
        amount: 129900,
        originalAmount: 259900,
        discount: 50,
        interval: 6,
        period: 'monthly',
        popular: false
    }
};

module.exports = { PLAN_CONFIG, PRO_BILLING_OPTIONS };
