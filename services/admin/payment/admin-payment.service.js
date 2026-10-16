import { prisma } from "@/lib/prisma";
import { authMiddleware } from "@/middleware/auth.middleware";

/**
 * Check whether current user is ADMIN
 */
const checkAdminAccess = async (req) => {
  const authUser = await authMiddleware(req);

  if (!authUser) {
    const error = new Error("Unauthorized");
    error.statusCode = 401;
    throw error;
  }

  if (authUser.role !== "ADMIN") {
    const error = new Error("Admin access required");
    error.statusCode = 403;
    throw error;
  }

  return authUser;
};

/**
 * Get admin payment log
 */
export const getAdminPaymentLogsService = async (req, query = {}) => {
  await checkAdminAccess(req);

  const page = Math.max(parseInt(query.page || "1", 10), 1);
  const limit = Math.min(
    Math.max(parseInt(query.limit || "10", 10), 1),
    100
  );

  const search = String(query.search || "").trim();
  const status = String(query.status || "").trim().toUpperCase();

  const skip = (page - 1) * limit;

  const where = {};

  /**
   * Payment status filter
   */
  if (
    status &&
    ["CREATED", "PENDING", "SUCCESS", "FAILED", "REFUNDED"].includes(status)
  ) {
    where.status = status;
  }

  /**
   * Search
   */
  if (search) {
    where.OR = [
      {
        razorpayPaymentId: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        razorpayOrderId: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        user: {
          email: {
            contains: search,
            mode: "insensitive",
          },
        },
      },
      {
        user: {
          profile: {
            fullName: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      },
      {
        user: {
          company: {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      },
    ];
  }

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,

      select: {
        id: true,
        userId: true,
        subscriptionId: true,
        amount: true,
        currency: true,
        status: true,
        razorpayOrderId: true,
        razorpayPaymentId: true,
        razorpayInvoiceId: true,      // ADD
        paidAt: true,
        failureReason: true,
        createdAt: true,
        updatedAt: true,

        user: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,

            profile: {
              select: {
                fullName: true,
                phone: true,
              },
            },

            company: {
              select: {
                name: true,
                businessType: true,
                gstNumber: true,
                panNumber: true,
                registrationNumber: true,
                businessEmail: true,
                businessPhone: true,
                address: true,
              },
            },
          },
        },

        subscription: {
          select: {
            id: true,
            razorpaySubscriptionId: true,  // ADD
            cancelledAt: true,             // ADD
            status: true,
            amount: true,
            billingCycle: true,
            startDate: true,
            endDate: true,
            createdAt: true,

            plan: {
              select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                price: true,
                billingCycle: true,
              },
            },
          },
        },
      },
    }),

    prisma.payment.count({
      where,
    }),
  ]);

  /**
   * Summary
   */
  const [
    totalSuccessfulPayments,
    totalPendingPayments,
    totalFailedPayments,
    successfulAmount,
  ] = await Promise.all([
    prisma.payment.count({
      where: {
        ...where,
        status: "SUCCESS",
      },
    }),

    prisma.payment.count({
      where: {
        ...where,
        status: "PENDING",
      },
    }),

    prisma.payment.count({
      where: {
        ...where,
        status: "FAILED",
      },
    }),

    prisma.payment.aggregate({
      where: {
        ...where,
        status: "SUCCESS",
      },
      _sum: {
        amount: true,
      },
    }),
  ]);

  const items = payments.map((payment) => ({
    id: payment.id,

    user: {
      id: payment.user.id,
      name: payment.user.profile?.fullName || "N/A",
      email: payment.user.email,
      phone: payment.user.profile?.phone || null,
      role: payment.user.role,
      status: payment.user.status,
    },

    company: payment.user.company
      ? {
          name: payment.user.company.name,
          businessType: payment.user.company.businessType,
          gstNumber: payment.user.company.gstNumber,
          panNumber: payment.user.company.panNumber,
          registrationNumber: payment.user.company.registrationNumber,
          businessEmail: payment.user.company.businessEmail,
          businessPhone: payment.user.company.businessPhone,
          address: payment.user.company.address,
        }
      : null,

    subscription: payment.subscription
      ? {
          id: payment.subscription.id,
          razorpaySubscriptionId: payment.subscription.razorpaySubscriptionId,  // ADD
          cancelledAt: payment.subscription.cancelledAt, 
          status: payment.subscription.status,
          amount: payment.subscription.amount,
          billingCycle: payment.subscription.billingCycle,
          startDate: payment.subscription.startDate,
          endDate: payment.subscription.endDate,
          createdAt: payment.subscription.createdAt,

          plan: payment.subscription.plan
            ? {
                id: payment.subscription.plan.id,
                name: payment.subscription.plan.name,
                slug: payment.subscription.plan.slug,
                description: payment.subscription.plan.description,
                price: payment.subscription.plan.price,
                billingCycle: payment.subscription.plan.billingCycle,
              }
            : null,
        }
      : null,

    payment: {
      id: payment.id,    
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: payment.razorpayPaymentId,
      razorpayInvoiceId: payment.razorpayInvoiceId,    // ADD
      paidAt: payment.paidAt,
      failureReason: payment.failureReason,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    },
  }));

  return {
    items,

    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1,
    },

    summary: {
      totalPayments: total,
      successfulPayments: totalSuccessfulPayments,
      pendingPayments: totalPendingPayments,
      failedPayments: totalFailedPayments,
      successfulAmount: successfulAmount._sum.amount || 0,
    },
  };
};

/**
 * Get one payment for receipt
 */
export const getAdminPaymentByIdService = async (req, paymentId) => {
  await checkAdminAccess(req);

  if (!paymentId) {
    const error = new Error("Payment ID is required");
    error.statusCode = 400;
    throw error;
  }

  const payment = await prisma.payment.findUnique({
    where: {
      id: paymentId,
    },

    select: {
      id: true,
      userId: true,
      subscriptionId: true,
      amount: true,
      currency: true,
      status: true,
      razorpayOrderId: true,
      razorpayPaymentId: true,
      razorpayInvoiceId: true,      // ADD
      paidAt: true,
      failureReason: true,
      createdAt: true,
      updatedAt: true,

      user: {
        select: {
          id: true,
          email: true,
          role: true,
          status: true,

          profile: {
            select: {
              fullName: true,
              phone: true,
            },
          },

          company: {
            select: {
              name: true,
              businessType: true,
              gstNumber: true,
              panNumber: true,
              registrationNumber: true,
              businessEmail: true,
              businessPhone: true,
              address: true,
            },
          },
        },
      },

      subscription: {
        select: {
          id: true,
          razorpaySubscriptionId: true,  // ADD
          cancelledAt: true,             // ADD
          status: true,
          amount: true,
          billingCycle: true,
          startDate: true,
          endDate: true,
          createdAt: true,

          plan: {
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              price: true,
              billingCycle: true,
            },
          },
        },
      },
    },
  });

  if (!payment) {
    const error = new Error("Payment not found");
    error.statusCode = 404;
    throw error;
  }

  /**
   * Receipt number.
   */
  const receiptNumber = payment.razorpayPaymentId
    ? `RCPT-${payment.razorpayPaymentId.slice(-8).toUpperCase()}`
    : `RCPT-${payment.id.slice(-8).toUpperCase()}`;

  return {
    receiptNumber,

    issuer: {
      name: "Off Contract",
      address:
        "Registered office address, Phase-II, Kanan Vihar, Patia, Bhubaneswar, Odisha",
      email: "ofctechindia@gmail.com",
      gstin: "",
      logo: "/icons/logo.png",
    },

    customer: {
      userId: payment.user.id,
      name: payment.user.profile?.fullName || "N/A",
      email: payment.user.email,
      phone: payment.user.profile?.phone || "",
      role: payment.user.role,
      status: payment.user.status,
    },

    business: payment.user.company
      ? {
          name: payment.user.company.name,
          businessType: payment.user.company.businessType,
          gstNumber: payment.user.company.gstNumber,
          panNumber: payment.user.company.panNumber,
          registrationNumber: payment.user.company.registrationNumber,
          businessEmail: payment.user.company.businessEmail,
          businessPhone: payment.user.company.businessPhone,
          address: payment.user.company.address,
        }
      : null,

    subscription: payment.subscription
      ? {
          id: payment.subscription.id,
          razorpaySubscriptionId: payment.subscription.razorpaySubscriptionId,  // ADD
          cancelledAt: payment.subscription.cancelledAt,                        // ADD
          status: payment.subscription.status,
          amount: payment.subscription.amount,
          billingCycle: payment.subscription.billingCycle,
          startDate: payment.subscription.startDate,
          endDate: payment.subscription.endDate,

          plan: payment.subscription.plan
            ? {
                id: payment.subscription.plan.id,
                name: payment.subscription.plan.name,
                slug: payment.subscription.plan.slug,
                description: payment.subscription.plan.description,
                price: payment.subscription.plan.price,
                billingCycle: payment.subscription.plan.billingCycle,
              }
            : null,
        }
      : null,

    payment: {
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: payment.razorpayPaymentId,
      razorpayInvoiceId: payment.razorpayInvoiceId,    // ADD
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      failureReason: payment.failureReason,
    },
  };
};