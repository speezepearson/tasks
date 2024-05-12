import { DocumentByName, FieldPaths, FieldTypeFromFieldPath, GenericDatabaseReader, NamedTableInfo, TableNamesInDataModel } from "convex/server";
import { DataModel, Id } from "../_generated/dataModel";

export async function getOneFiltered<
    TableName extends TableNamesInDataModel<DataModel>,
    Field extends FieldPaths<NamedTableInfo<DataModel, TableName>>,
    Value extends FieldTypeFromFieldPath<DocumentByName<DataModel, TableName>, Field>,
>(
    db: GenericDatabaseReader<DataModel>,
    id: Id<TableName>,
    field: Field,
    value: Value,
): Promise<DocumentByName<DataModel, TableName> | null> {
    const res = await db.get(id);
    if (res === null || res[field] !== value) {
        return null;
    }
    return res;
}

