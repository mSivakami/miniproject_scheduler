import { motion } from "motion/react";

export function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="flex-1 flex flex-col"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}