"use server";
import { z } from "zod";
import { sql } from "@vercel/postgres";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signIn } from "next-auth/react";

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: "Please select a customer.",
    }),
    amount: z.coerce.number().gt(0, { message: "PLease select an amount greater than 0$." }),
    status: z.enum(["pending", "paid"], {
        invalid_type_error: "PLease select an invoices status.",
    }),
    date: z.string(),
});

export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
};

const CreateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(prevState: State, formData: FormData) {
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get("customerId"),
        amount: formData.get("amount"),
        status: formData.get("status"),
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: "Missing Fields. Failed to create Invoice.",
        };
    }

    const { customerId, amount, status } = validatedFields.data;

    const amountInCents = amount * 100;
    const date = new Date().toISOString().split("T")[0];

    try {
        await sql`
        INSERT INTO invoices (customer_id, amount, status, date)    
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
    } catch (error) {
        return { message: "Catabase Error: Failed to Create Invoice" };
    }
    revalidatePath("/dashboard/invoices");
    redirect("/dashboard/invoices");
}

const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function updateInvoice(id: string, formData: FormData) {
    const { customerId, amount, status } = UpdateInvoice.parse({
        customerId: formData.get("customerId"),
        amount: formData.get("amount"),
        status: formData.get("status"),
    });
    const amountInCents = amount * 100;

    try {
        await sql`
        UPDATE invoices        
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
    `;

        revalidatePath("/dashboard/invoices");
        redirect("/dashboard/invoices");
    } catch (error) {
        return { message: "Catabase Error: Failed to Update Invoice" };
    }
}

export async function deleteInvoice(id: string) {
    try {
        await sql`DELETE from invoices WHERE id = ${id}`;
        revalidatePath("/dashboard/invoices");
    } catch (error) {
        return { message: "Catabase Error: Failed to Delete Invoice" };
    }
}

export async function authenticate(prevState: string | undefined, formData: FormData) {
    try {
        await signIn("credentials", Object.fromEntries(formData));
    } catch (error) {
        if ((error as Error).message.includes("CredentialSignin")) {
            return "CredentialSignin";
        }
        throw error;
    }
}
