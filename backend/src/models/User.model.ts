import mongoose, { Document, Model, Schema } from "mongoose";
import bcrypt from "bcryptjs";

/**
 * TypeScript interface describing what a User document looks like.
 * We extend mongoose.Document so TypeScript knows about _id, save(), etc.
 * on top of our own fields.
 */
export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true, // creates a unique index - MongoDB rejects duplicate emails at the DB level
      lowercase: true, // normalizes "John@Email.com" -> "john@email.com" before saving
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false, // NEVER return the password field by default on any query
    },
    role: {
      type: String,
      enum: ["user", "admin"], // only these two values are allowed - anything else is rejected
      default: "user",
    },
  },
  {
    timestamps: true, // auto-adds and maintains createdAt / updatedAt
  }
);

/**
 * Mongoose "pre-save" hook: runs automatically right before a document
 * is saved to the database.
 *
 * Why hash here instead of in the controller?
 * - Guarantees the password is ALWAYS hashed no matter which code path
 *   creates/updates a user (register endpoint today, admin panel later,
 *   a seed script, etc.) - impossible to forget.
 *
 * `this.isModified("password")` check matters because this hook also runs
 * when we update OTHER fields (like changing a user's name) - we only want
 * to re-hash the password if it actually changed, otherwise editing your
 * name would re-hash an already-hashed password and break your login.
 */
userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Instance method available on every user document: user.comparePassword(...)
 * We compare the plain-text password the user typed at login against the
 * hashed one stored in the DB. bcrypt.compare handles hashing the candidate
 * internally and comparing hashes - we never decrypt the stored password
 * (bcrypt hashes are one-way, that's the whole point).
 */
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

const User: Model<IUser> = mongoose.model<IUser>("User", userSchema);

export default User;