import { useCallback, useMemo, useRef, useState } from "react";

export type ValidationResult = string | undefined;

export type FieldValidator<V> = (value: V, values: Readonly<Record<string, unknown>>) => ValidationResult;

export type FieldConfig<V = unknown> = {
    /**
     * Initial value.
     */
    readonly initialValue: V;

    /**
     * Optional validator. Return a string to indicate an error; return
     * `undefined` for valid.
     */
    readonly validate?: FieldValidator<V>;
};

export type FormSchema = Readonly<Record<string, FieldConfig<never>>>;

export type FormValues<S extends Readonly<Record<string, FieldConfig<unknown>>>> = {
    [K in keyof S]: S[K] extends FieldConfig<infer V> ? V : never;
};

export type UseFormOptions<S extends Readonly<Record<string, FieldConfig<unknown>>>> = {
    /**
     * Field declarations.
     */
    readonly fields: S;

    /**
     * Called on submit if all fields validate.
     */
    readonly onSubmit?: (values: FormValues<S>) => void | Promise<void>;
};

export type UseFormResult<S extends Readonly<Record<string, FieldConfig<unknown>>>> = {
    /**
     * Map of fieldName -> validation error (if any).
     */
    readonly errors: Readonly<Partial<Record<keyof S, string>>>;

    /**
     * True while the last `submit()` is in-flight.
     */
    readonly isSubmitting: boolean;

    /**
     * Reset all fields back to their initial values and clear errors / touched.
     */
    readonly reset: () => void;

    /**
     * Mark a field as touched. Useful on blur.
     */
    readonly setTouched: <K extends keyof S>(name: K, touched?: boolean) => void;

    /**
     * Update a single field.
     */
    readonly setValue: <K extends keyof S>(name: K, value: FormValues<S>[K]) => void;

    /**
     * Trigger validation and call the `onSubmit` option. Returns true if
     * submission succeeded (all fields valid).
     */
    readonly submit: () => Promise<boolean>;

    /**
     * Map of fieldName -> boolean. Field is considered touched after the
     * first `setTouched(name)` or `submit()` invocation.
     */
    readonly touched: Readonly<Partial<Record<keyof S, boolean>>>;

    /**
     * Current values.
     */
    readonly values: FormValues<S>;
};

const deriveInitialValues = <S extends Readonly<Record<string, FieldConfig<unknown>>>>(fields: S): FormValues<S> => {
    const values = {} as Record<string, unknown>;

    for (const name of Object.keys(fields)) {
        values[name] = (fields[name] as FieldConfig<unknown>).initialValue;
    }

    return values as FormValues<S>;
};

/**
 * Minimal headless form state machine. Tracks values, touched state, errors,
 * and submission in-flight. Pair with `<Form />` for default layout, or wire
 * up your own inputs directly.
 */
const useForm = <S extends Readonly<Record<string, FieldConfig<unknown>>>>(options: UseFormOptions<S>): UseFormResult<S> => {
    const { fields, onSubmit } = options;
    const initialValues = useMemo(() => deriveInitialValues(fields), [fields]);

    const [values, setValues] = useState<FormValues<S>>(initialValues);
    const [errors, setErrors] = useState<Partial<Record<keyof S, string>>>({});
    const [touched, setTouchedState] = useState<Partial<Record<keyof S, boolean>>>({});
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const valuesRef = useRef(values);

    valuesRef.current = values;

    const validateField = useCallback(
        <K extends keyof S>(name: K, value: FormValues<S>[K]): ValidationResult => {
            const config = fields[name as string] as FieldConfig<FormValues<S>[K]> | undefined;

            return config?.validate?.(value, valuesRef.current as Readonly<Record<string, unknown>>);
        },
        [fields],
    );

    const setValue = useCallback(
        <K extends keyof S>(name: K, value: FormValues<S>[K]) => {
            setValues((previous) => ({ ...previous, [name]: value }));

            const error = validateField(name, value);

            setErrors((previous) => {
                if (error === undefined) {
                    const next = { ...previous };

                    delete next[name];

                    return next;
                }

                return { ...previous, [name]: error };
            });
        },
        [validateField],
    );

    const setTouched = useCallback(
        <K extends keyof S>(name: K, isTouched = true) => {
            setTouchedState((previous) => ({ ...previous, [name]: isTouched }));
        },
        [],
    );

    const reset = useCallback(() => {
        setValues(initialValues);
        setErrors({});
        setTouchedState({});
    }, [initialValues]);

    const submit = useCallback(async (): Promise<boolean> => {
        const nextErrors: Partial<Record<keyof S, string>> = {};
        const nextTouched: Partial<Record<keyof S, boolean>> = {};

        for (const key of Object.keys(fields) as Array<keyof S>) {
            nextTouched[key] = true;
            const error = validateField(key, valuesRef.current[key]);

            if (error !== undefined) {
                nextErrors[key] = error;
            }
        }

        setErrors(nextErrors);
        setTouchedState(nextTouched);

        if (Object.keys(nextErrors).length > 0) {
            return false;
        }

        try {
            setIsSubmitting(true);
            await onSubmit?.(valuesRef.current);

            return true;
        } finally {
            setIsSubmitting(false);
        }
    }, [fields, validateField, onSubmit]);

    return {
        errors,
        isSubmitting,
        reset,
        setTouched,
        setValue,
        submit,
        touched,
        values,
    };
};

export default useForm;
