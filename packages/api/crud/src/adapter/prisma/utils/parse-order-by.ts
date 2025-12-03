import type { OrderByField, OrderByOperator } from "../../../types";
import type { PrismaOrderBy, PrismaOrderByOperator } from "../types";

const operatorsAssociation: Record<OrderByOperator, PrismaOrderByOperator> = {
    $asc: "asc",
    $desc: "desc",
};

const parsePrismaOrderBy = (orderBy: OrderByField): PrismaOrderBy => {
    const parsed: PrismaOrderBy = {};

    Object.keys(orderBy).forEach((key) => {
        const value = orderBy[key];

        parsed[key] = operatorsAssociation[value as OrderByOperator];
    });

    return parsed;
};

export default parsePrismaOrderBy;
